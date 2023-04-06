import {
  ArrayVector,
  DataFrame,
  DataFrameJSON,
  decodeFieldValueEntities,
  Field,
  FieldDTO,
  FieldSchema,
  FieldType,
  guessFieldTypeFromValue,
  Labels,
  parseLabels,
  QueryResultMeta,
  toFilteredDataFrameDTO,
} from '@grafana/data';
import { join } from '@grafana/data/src/transformations/transformers/joinDataFrames';
import { StreamingFrameAction, StreamingFrameOptions } from '@grafana/runtime/src/services/live';
import { renderLegendFormat } from 'app/plugins/datasource/prometheus/legend';
import { AlignedData } from 'uplot';

/**
 * Stream packet info is attached to StreamingDataFrames and indicate how many
 * rows were added to the end of the frame.  The number of discarded rows can be
 * calculated from previous state
 */
export interface StreamPacketInfo {
  number: number;
  action: StreamingFrameAction;
  length: number;
  schemaChanged: boolean;
}

const PROM_STYLE_METRIC_LABEL = '__name__';

enum PushMode {
  wide,
  labels,
  // long
}

export type SerializedStreamingDataFrame = {
  name?: string;
  fields: FieldDTO[];
  refId?: string;
  meta: QueryResultMeta;
  schemaFields: FieldSchema[];
  timeFieldIndex: number;
  pushMode: PushMode;
  length: number;
  packetInfo: StreamPacketInfo;
  options: StreamingFrameOptions;
  labels: Set<string>;
};

/**
 * Unlike a circular buffer, this will append and periodically slice the front
 */
export class StreamingDataFrame implements DataFrame {
  name?: string;
  refId?: string;
  meta: QueryResultMeta = {};

  fields: Array<Field<any, ArrayVector<any>>> = [];
  length = 0;

  private schemaFields: FieldSchema[] = [];
  private timeFieldIndex = -1;
  private pushMode = PushMode.wide;

  // current labels
  private labels: Set<string> = new Set();
  readonly packetInfo: StreamPacketInfo = {
    schemaChanged: true,
    number: 0,
    action: StreamingFrameAction.Replace,
    length: 0,
  };

  private constructor(public options: StreamingFrameOptions) {
    // Get Length to show up if you use spread
    Object.defineProperty(this, 'length', {
      enumerable: true,
    });

    // Get fields to show up if you use spread
    Object.defineProperty(this, 'fields', {
      enumerable: true,
    });
  }

  serialize = (
    fieldPredicate?: (f: Field) => boolean,
    optionsOverride?: Partial<StreamingFrameOptions>,
    trimValues?: {
      maxLength?: number;
    }
  ): SerializedStreamingDataFrame => {
    const options = optionsOverride ? Object.assign({}, { ...this.options, ...optionsOverride }) : this.options;
    const dataFrameDTO = toFilteredDataFrameDTO(this, fieldPredicate);

    const numberOfItemsToRemove = getNumberOfItemsToRemove(
      dataFrameDTO.fields.map((f) => f.values) as unknown[][],
      typeof trimValues?.maxLength === 'number' ? Math.min(trimValues.maxLength, options.maxLength) : options.maxLength,
      this.timeFieldIndex,
      options.maxDelta
    );

    dataFrameDTO.fields = dataFrameDTO.fields.map((f) => ({
      ...f,
      values: (f.values as unknown[]).slice(numberOfItemsToRemove),
    }));

    const length = dataFrameDTO.fields[0]?.values?.length ?? 0

    return {
      ...dataFrameDTO,
      // TODO: Labels and schema are not filtered by field
      labels: this.labels,
      schemaFields: this.schemaFields,

      name: this.name,
      refId: this.refId,
      meta: this.meta,
      length,
      timeFieldIndex: this.timeFieldIndex,
      pushMode: this.pushMode,
      packetInfo: this.packetInfo,
      options,
    };
  };

  private initFromSerialized = (serialized: Omit<SerializedStreamingDataFrame, 'options'>) => {
    this.name = serialized.name;
    this.refId = serialized.refId;
    this.meta = serialized.meta;
    this.length = serialized.length;
    this.labels = serialized.labels;
    this.schemaFields = serialized.schemaFields;
    this.timeFieldIndex = serialized.timeFieldIndex;
    this.pushMode = serialized.pushMode;
    this.packetInfo.length = serialized.packetInfo.length;
    this.packetInfo.number = serialized.packetInfo.number;
    this.packetInfo.action = StreamingFrameAction.Replace;
    this.packetInfo.schemaChanged = true;
    this.fields = serialized.fields.map((f) => ({
      ...f,
      type: f.type ?? FieldType.other,
      config: f.config ?? {},
      values: Array.isArray(f.values) ? new ArrayVector(f.values) : new ArrayVector(),
    }));

    assureValuesAreWithinLengthLimit(
      this.fields.map((f) => f.values.buffer),
      this.options.maxLength,
      this.timeFieldIndex,
      this.options.maxDelta
    );
  };

  static deserialize = (serialized: SerializedStreamingDataFrame) => {
    const frame = new StreamingDataFrame(serialized.options);
    frame.initFromSerialized(serialized);
    return frame;
  };

  static empty = (opts?: Partial<StreamingFrameOptions>): StreamingDataFrame =>
    new StreamingDataFrame(getStreamingFrameOptions(opts));

  static fromDataFrameJSON = (frame: DataFrameJSON, opts?: Partial<StreamingFrameOptions>): StreamingDataFrame => {
    const streamingDataFrame = new StreamingDataFrame(getStreamingFrameOptions(opts));
    streamingDataFrame.push(frame);
    return streamingDataFrame;
  };

  private get alwaysReplace() {
    return this.options.action === StreamingFrameAction.Replace;
  }

  needsResizing = ({ maxLength, maxDelta }: StreamingFrameOptions) => {
    const needsMoreLength = maxLength && this.options.maxLength < maxLength;
    const needsBiggerDelta = maxDelta && this.options.maxDelta < maxDelta;
    const needsToOverrideDefaultInfinityDelta = maxDelta && this.options.maxDelta === Infinity;
    return Boolean(needsMoreLength || needsBiggerDelta || needsToOverrideDefaultInfinityDelta);
  };

  resize = ({ maxLength, maxDelta }: Partial<StreamingFrameOptions>) => {
    if (maxDelta) {
      if (this.options.maxDelta === Infinity) {
        this.options.maxDelta = maxDelta;
      } else {
        this.options.maxDelta = Math.max(maxDelta, this.options.maxDelta);
      }
    }
    this.options.maxLength = Math.max(this.options.maxLength, maxLength ?? 0);
  };

  /**
   * apply the new message to the existing data.  This will replace the existing schema
   * if a new schema is included in the message, or append data matching the current schema
   */
  push(msg: DataFrameJSON): StreamPacketInfo {
    const { schema, data } = msg;

    this.packetInfo.number++;
    this.packetInfo.length = 0;
    this.packetInfo.schemaChanged = false;

    if (schema) {
      this.pushMode = PushMode.wide;
      this.timeFieldIndex = schema.fields.findIndex((f) => f.type === FieldType.time);
      const firstField = schema.fields[0];
      if (
        this.timeFieldIndex === 1 &&
        firstField.type === FieldType.string &&
        (firstField.name === 'labels' || firstField.name === 'Labels')
      ) {
        this.pushMode = PushMode.labels;
        this.timeFieldIndex = 0; // after labels are removed!
      }

      const niceSchemaFields = this.pushMode === PushMode.labels ? schema.fields.slice(1) : schema.fields;

      this.refId = schema.refId;
      if (schema.meta) {
        this.meta = { ...schema.meta };
      }

      const { displayNameFormat } = this.options;
      if (hasSameStructure(this.schemaFields, niceSchemaFields)) {
        const len = niceSchemaFields.length;
        this.fields.forEach((f, idx) => {
          const sf = niceSchemaFields[idx % len];
          f.config = sf.config ?? {};
          f.labels = sf.labels;
        });
        if (displayNameFormat) {
          this.fields.forEach((f) => {
            const labels = { [PROM_STYLE_METRIC_LABEL]: f.name, ...f.labels };
            f.config.displayNameFromDS = renderLegendFormat(displayNameFormat, labels);
          });
        }
      } else {
        this.packetInfo.schemaChanged = true;
        const isWide = this.pushMode === PushMode.wide;
        this.fields = niceSchemaFields.map((f) => {
          const config = f.config ?? {};
          if (displayNameFormat) {
            const labels = { [PROM_STYLE_METRIC_LABEL]: f.name, ...f.labels };
            config.displayNameFromDS = renderLegendFormat(displayNameFormat, labels);
          }
          return {
            config,
            name: f.name,
            labels: f.labels,
            type: f.type ?? FieldType.other,
            // transfer old values by type & name, unless we relied on labels to match fields
            values: isWide
              ? this.fields.find((of) => of.name === f.name && f.type === of.type)?.values ??
                new ArrayVector(Array(this.length).fill(undefined))
              : new ArrayVector(),
          };
        });
      }

      this.schemaFields = niceSchemaFields;
    }

    if (data && data.values.length && data.values[0].length) {
      let { values, entities } = data;

      if (entities) {
        entities.forEach((ents, i) => {
          if (ents) {
            decodeFieldValueEntities(ents, values[i]);
            // TODO: append replacements to field
          }
        });
      }

      if (this.pushMode === PushMode.labels) {
        // augment and transform data to match current schema for standard circPush() path
        const labeledTables = transpose(values);

        // make sure fields are initalized for each label
        for (const label of labeledTables.keys()) {
          if (!this.labels.has(label)) {
            this.packetInfo.schemaChanged = true;
            this.addLabel(label);
          }
        }

        // TODO: cache higher up
        let dummyTable = Array(this.schemaFields.length).fill([]);

        let tables: AlignedData[] = [];
        this.labels.forEach((label) => {
          tables.push(labeledTables.get(label) ?? dummyTable);
        });

        values = join(tables);
      }

      if (values.length !== this.fields.length) {
        if (this.fields.length) {
          throw new Error(
            `push message mismatch.  Expected: ${this.fields.length}, received: ${values.length} (labels=${
              this.pushMode === PushMode.labels
            })`
          );
        }

        this.fields = values.map((vals, idx) => {
          let name = `Field ${idx}`;
          let type = guessFieldTypeFromValue(vals[0]);
          const isTime = idx === 0 && type === FieldType.number && (vals as number[])[0] > 1600016688632;
          if (isTime) {
            type = FieldType.time;
            name = 'Time';
          }

          return {
            name,
            type,
            config: {},
            values: new ArrayVector([]),
          };
        });
      }

      let appended = values;
      this.packetInfo.length = values[0].length;

      if (this.alwaysReplace || !this.length) {
        this.packetInfo.action = StreamingFrameAction.Replace;
      } else {
        this.packetInfo.action = StreamingFrameAction.Append;

        // mutates appended
        appended = this.fields.map((f) => f.values.buffer);
        circPush(appended, values, this.options.maxLength, this.timeFieldIndex, this.options.maxDelta);
      }

      appended.forEach((v, i) => {
        const { state, values } = this.fields[i];
        values.buffer = v as any[];
        if (state) {
          state.calcs = undefined;
        }
      });

      // Update the frame length
      this.length = appended[0].length;
    }

    return {
      ...this.packetInfo,
    };
  }

  pushNewValues = (values: unknown[][]) => {
    if (!values?.length) {
      return;
    }

    this.packetInfo.action = this.options.action;
    this.packetInfo.number++;
    this.packetInfo.length = values[0].length;
    this.packetInfo.schemaChanged = false;

    if (this.options.action === StreamingFrameAction.Append) {
      circPush(
        this.fields.map((f) => f.values.buffer),
        values,
        this.options.maxLength,
        this.timeFieldIndex,
        this.options.maxDelta
      );
    } else {
      values.forEach((v, i) => {
        if (this.fields[i]?.values) {
          this.fields[i].values.buffer = v as any[];
        }
      });

      assureValuesAreWithinLengthLimit(
        this.fields.map((f) => f.values.buffer),
        this.options.maxLength,
        this.timeFieldIndex,
        this.options.maxDelta
      );
    }
    const newLength = this.fields?.[0]?.values?.buffer?.length;
    if (newLength !== undefined) {
      this.length = newLength;
    }
  };

  resetStateCalculations = () => {
    this.fields.forEach((f) => {
      f.state = {
        ...(f.state ?? {}),
        calcs: undefined,
        range: undefined,
      };
    });
  };

  getMatchingFieldIndexes = (fieldPredicate: (f: Field) => boolean): number[] =>
    this.fields
      .map((f, index) => (fieldPredicate(f) ? index : undefined))
      .filter((val) => val !== undefined) as number[];

  getValuesFromLastPacket = (): unknown[][] =>
    this.fields.map((f) => {
      const values = f.values.buffer;
      return values.slice(Math.max(values.length - this.packetInfo.length));
    });

  hasAtLeastOnePacket = () => Boolean(this.packetInfo.length);

  // adds a set of fields for a new label
  private addLabel(label: string) {
    const { displayNameFormat } = this.options;
    const labelCount = this.labels.size;

    // parse labels
    const parsedLabels = parseLabelsFromField(label);

    if (labelCount === 0) {
      // mutate existing fields and add labels
      this.fields.forEach((f, i) => {
        if (i > 0) {
          f.labels = parsedLabels;
          if (displayNameFormat) {
            const labels = { [PROM_STYLE_METRIC_LABEL]: f.name, ...parsedLabels };
            f.config.displayNameFromDS = renderLegendFormat(displayNameFormat, labels);
          }
        }
      });
    } else {
      for (let i = 1; i < this.schemaFields.length; i++) {
        let proto = this.schemaFields[i] as Field;
        const config = proto.config ?? {};
        if (displayNameFormat) {
          const labels = { [PROM_STYLE_METRIC_LABEL]: proto.name, ...parsedLabels };
          config.displayNameFromDS = renderLegendFormat(displayNameFormat, labels);
        }
        this.fields.push({
          ...proto,
          config,
          labels: parsedLabels,
          values: new ArrayVector(Array(this.length).fill(undefined)),
        });
      }
    }

    this.labels.add(label);
  }

  getOptions = (): Readonly<StreamingFrameOptions> => this.options;
}

export function getStreamingFrameOptions(opts?: Partial<StreamingFrameOptions>): StreamingFrameOptions {
  return {
    maxLength: opts?.maxLength ?? 1000,
    maxDelta: opts?.maxDelta ?? Infinity,
    action: opts?.action ?? StreamingFrameAction.Append,
    displayNameFormat: opts?.displayNameFormat,
  };
}

// converts vertical insertion records with table keys in [0] and column values in [1...N]
// to join()-able tables with column arrays
export function transpose(vrecs: any[][]) {
  let tableKeys = new Set(vrecs[0]);
  let tables = new Map();

  tableKeys.forEach((key) => {
    let cols = Array(vrecs.length - 1)
      .fill(null)
      .map(() => []);

    tables.set(key, cols);
  });

  for (let r = 0; r < vrecs[0].length; r++) {
    let table = tables.get(vrecs[0][r]);
    for (let c = 1; c < vrecs.length; c++) {
      table[c - 1].push(vrecs[c][r]);
    }
  }

  return tables;
}

// binary search for index of closest value
export function closestIdx(num: number, arr: number[], lo?: number, hi?: number) {
  let mid;
  lo = lo || 0;
  hi = hi || arr.length - 1;
  let bitwise = hi <= 2147483647;

  while (hi - lo > 1) {
    mid = bitwise ? (lo + hi) >> 1 : Math.floor((lo + hi) / 2);

    if (arr[mid] < num) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  if (num - arr[lo] <= arr[hi] - num) {
    return lo;
  }

  return hi;
}

export function parseLabelsFromField(str: string): Labels {
  if (!str.length) {
    return {};
  }
  if (str.charAt(0) === '{') {
    return parseLabels(str);
  }
  const parsedLabels: Labels = {};
  str.split(',').forEach((kv) => {
    const [key, val] = kv.trim().split('=');
    parsedLabels[key] = val;
  });
  return parsedLabels;
}

/**
 * @internal // not exported in yet
 */
export function getLastStreamingDataFramePacket(frame: DataFrame) {
  const pi = (frame as StreamingDataFrame).packetInfo;
  return pi?.action ? pi : undefined;
}

// mutable circular push
function circPush(data: unknown[][], newData: unknown[][], maxLength = Infinity, deltaIdx = 0, maxDelta = Infinity) {
  for (let i = 0; i < data.length; i++) {
    for (let k = 0; k < newData[i].length; k++) {
      data[i].push(newData[i][k]);
    }
  }

  return assureValuesAreWithinLengthLimit(data, maxLength, deltaIdx, maxDelta);
}

function assureValuesAreWithinLengthLimit(data: unknown[][], maxLength = Infinity, deltaIdx = 0, maxDelta = Infinity) {
  const count = getNumberOfItemsToRemove(data, maxLength, deltaIdx, maxDelta);

  if (count) {
    for (let i = 0; i < data.length; i++) {
      data[i].splice(0, count);
    }
  }

  return count;
}

function getNumberOfItemsToRemove(data: unknown[][], maxLength = Infinity, deltaIdx = 0, maxDelta = Infinity) {
  if (!data[0]?.length) {
    return 0;
  }

  const nlen = data[0].length;

  let sliceIdx = 0;

  if (nlen > maxLength) {
    sliceIdx = nlen - maxLength;
  }

  if (maxDelta !== Infinity && deltaIdx >= 0) {
    const deltaLookup = data[deltaIdx] as number[];

    const low = deltaLookup[sliceIdx];
    const high = deltaLookup[nlen - 1];

    if (high - low > maxDelta) {
      sliceIdx = closestIdx(high - maxDelta, deltaLookup, sliceIdx);
    }
  }

  return sliceIdx;
}

function hasSameStructure(a: FieldSchema[], b: FieldSchema[]): boolean {
  if (a?.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    const fA = a[i];
    const fB = b[i];
    if (fA.name !== fB.name || fA.type !== fB.type) {
      return false;
    }
  }
  return true;
}
