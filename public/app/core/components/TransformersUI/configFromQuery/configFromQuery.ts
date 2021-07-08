import { map } from 'rxjs/operators';
import {
  ArrayVector,
  DataFrame,
  DataTransformerID,
  DataTransformerInfo,
  Field,
  FieldMatcherID,
  getFieldDisplayName,
  getFieldMatcher,
  MatcherConfig,
  reduceField,
  ReducerID,
} from '@grafana/data';
import { getFieldConfigFromFrame, RowToFieldsTransformMappings } from '../rowsToFields/rowsToFields';

export interface ConfigFromQueryTransformerOptions {
  configRefId: string;
  mappings: RowToFieldsTransformMappings[];
  applyTo?: MatcherConfig;
  applyToConfigQuery?: boolean;
}

export const configFromDataTransformer: DataTransformerInfo<ConfigFromQueryTransformerOptions> = {
  id: DataTransformerID.configFromData,
  name: 'Config from query',
  description: 'Set unit, min, max and more from data',
  defaultOptions: {},

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  operator: (options) => (source) => source.pipe(map((data) => extractConfigFromQuery(options, data))),
};

export function extractConfigFromQuery(options: ConfigFromQueryTransformerOptions, data: DataFrame[]) {
  let configFrame: DataFrame | null = null;

  for (const frame of data) {
    if (frame.refId === options.configRefId) {
      configFrame = frame;
      break;
    }
  }

  if (!configFrame) {
    return data;
  }

  const reducedConfigFrame: DataFrame = {
    fields: [],
    length: 1,
  };

  // reduce config frame
  for (const field of configFrame.fields) {
    const newField = { ...field };
    const reducerId = getFieldReducer(field, configFrame, options.mappings);
    const result = reduceField({ field, reducers: [reducerId] });
    newField.values = new ArrayVector([result[reducerId]]);
    reducedConfigFrame.fields.push(newField);
  }

  const output: DataFrame[] = [];
  const matcher = getFieldMatcher(options.applyTo || { id: FieldMatcherID.numeric });

  for (const frame of data) {
    // Skip config frame in output
    if (frame === configFrame || options.applyToConfigQuery) {
      continue;
    }

    const outputFrame: DataFrame = {
      fields: [],
      length: frame.length,
    };

    for (const field of frame.fields) {
      if (matcher(field, frame, data)) {
        const dataConfig = getFieldConfigFromFrame(reducedConfigFrame, 0, options.mappings);
        outputFrame.fields.push({
          ...field,
          config: {
            ...field.config,
            ...dataConfig,
          },
        });
      } else {
        outputFrame.fields.push(field);
      }
    }

    output.push(outputFrame);
  }

  return output;
}

function getFieldReducer(field: Field, frame: DataFrame, mappings: RowToFieldsTransformMappings[]): ReducerID {
  const fieldName = getFieldDisplayName(field, frame);

  for (const mapping of mappings) {
    if (fieldName === mapping.fieldName && mapping.reducerId) {
      return mapping.reducerId;
    }
  }

  return ReducerID.lastNotNull;
}
