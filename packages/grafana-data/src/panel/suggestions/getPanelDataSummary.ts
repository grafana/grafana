import { PreferredVisualisationType } from '../../types/data';
import { DataFrame, FieldType } from '../../types/dataFrame';
import { DataFrameType } from '../../types/dataFrameTypes';

export interface PanelDataSummary {
  hasData?: boolean;
  rowCountTotal: number;
  /** max number of rows in any given dataframe in the panel data */
  rowCountMax: number;
  frameCount: number;
  fieldCount: number;
  /** max number of fields in any given dataframe in the panel data */
  fieldCountMax: number;
  /** given a field type, return the number of fields across all dataframes which match this type */
  fieldCountByType: (type: FieldType) => number;
  /** returns true if any fields in any frames match the field type */
  hasFieldType: (type: FieldType) => boolean;
  /* returns true if any of the frames in this panel data summary have the type */
  hasDataFrameType: (type: DataFrameType) => boolean;
  /* returns true if any of the frames in this panel data summary have the type */
  hasPreferredVisualisationType: (type: PreferredVisualisationType) => boolean;

  /** pass along a reference to the DataFrame array in case it's needed by the plugin */
  rawFrames?: DataFrame[];

  /* --- DEPRECATED FIELDS BELOW --- */
  /** @deprecated use PanelDataSummary.fieldCountByType(FieldType.number) */
  numberFieldCount: number;
  /** @deprecated use PanelDataSummary.fieldCountByType(FieldType.time) */
  timeFieldCount: number;
  /** @deprecated use PanelDataSummary.fieldCountByType(FieldType.string) */
  stringFieldCount: number;
  /** @deprecated use PanelDataSummary.hasFieldType(FieldType.number) */
  hasTimeField?: boolean;
  /** @deprecated use PanelDataSummary.hasFieldType(FieldType.time) */
  hasNumberField?: boolean;
  /** @deprecated use PanelDataSummary.hasFieldType(FieldType.string) */
  hasStringField?: boolean;
}

/**
 * @alpha
 */
class PanelDataSummaryImpl implements PanelDataSummary {
  public rowCountTotal = 0;
  /** max number of rows in any single dataframe in the panel data */
  public rowCountMax = 0;
  public fieldCount = 0;
  /** max number of fields in any single dataframe in the panel data */
  public fieldCountMax = 0;

  private countByType: Partial<Record<FieldType, number>> = {};
  private preferredVisualisationTypes: Set<PreferredVisualisationType> = new Set<PreferredVisualisationType>();
  private dataFrameTypes: Set<DataFrameType> = new Set<DataFrameType>();

  public get hasData(): boolean {
    return this.rowCountTotal > 0;
  }

  public get frameCount(): number {
    return this.rawFrames?.length ?? 0;
  }

  constructor(public rawFrames?: DataFrame[]) {
    this._processFrames();
  }

  private _processFrames() {
    for (const frame of this.rawFrames ?? []) {
      this.rowCountTotal += frame.length;

      if (frame.meta?.preferredVisualisationType) {
        this.preferredVisualisationTypes.add(frame.meta.preferredVisualisationType);
      }
      if (frame.meta?.type) {
        this.dataFrameTypes.add(frame.meta.type);
      }

      for (const field of frame.fields) {
        this.fieldCount++;
        this.countByType[field.type] = (this.countByType[field.type] || 0) + 1;
      }

      if (frame.length > this.rowCountMax) {
        this.rowCountMax = frame.length;
      }
      if (frame.fields.length > this.fieldCountMax) {
        this.fieldCountMax = frame.fields.length;
      }
    }
  }

  public fieldCountByType(type: FieldType): number {
    return this.countByType[type] ?? 0;
  }

  public hasFieldType(type: FieldType): boolean {
    return this.fieldCountByType(type) > 0;
  }

  public hasPreferredVisualisationType(type: PreferredVisualisationType): boolean {
    return this.preferredVisualisationTypes.has(type);
  }

  public hasDataFrameType(type: DataFrameType): boolean {
    return this.dataFrameTypes.has(type);
  }

  /**** DEPRECATED ****/
  /** @deprecated use PanelDataSummary.fieldCountByType(FieldType.number) */
  public get numberFieldCount(): number {
    return this.fieldCountByType(FieldType.number);
  }
  /** @deprecated use PanelDataSummary.fieldCountByType(FieldType.time) */
  public get timeFieldCount(): number {
    return this.fieldCountByType(FieldType.time);
  }
  /** @deprecated use PanelDataSummary.fieldCountByType(FieldType.string) */
  public get stringFieldCount() {
    return this.fieldCountByType(FieldType.string);
  }
  /** @deprecated use PanelDataSummary.hasFieldType(FieldType.number) */
  public get hasTimeField() {
    return this.fieldCountByType(FieldType.time) > 0;
  }
  /** @deprecated use PanelDataSummary.hasFieldType(FieldType.time) */
  public get hasNumberField() {
    return this.fieldCountByType(FieldType.number) > 0;
  }
  /** @deprecated use PanelDataSummary.hasFieldType(FieldType.string) */
  public get hasStringField() {
    return this.fieldCountByType(FieldType.string) > 0;
  }
}

/**
 * @alpha
 * given a list of dataframes, summarize attributes of those frames for features like suggestions.
 * @param frames - dataframes to summarize
 * @returns summary of the dataframes
 */
export function getPanelDataSummary(frames?: DataFrame[]): PanelDataSummary {
  return new PanelDataSummaryImpl(frames);
}
