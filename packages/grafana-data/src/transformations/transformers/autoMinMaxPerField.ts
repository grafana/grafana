import { DataTransformerID } from './ids';
import { DataTransformerInfo } from '../../types/transformations';
import { DataFrame, Field, FieldType, FieldConfig } from '../../types/dataFrame';
import { ReducerID, reduceField } from '../../transformations';
import isNumber from 'lodash/isNumber';

export interface AutoMinMaxPerFieldTransformerOptions {}

export const autoMinMaxPerFieldTransformer: DataTransformerInfo<AutoMinMaxPerFieldTransformerOptions> = {
  id: DataTransformerID.autoMinMaxPerField,
  name: 'Calculate min/max per field',
  description: `Calculate min/max for each field rather than for the complete set of data.
                Useful for cells in bar gauges.`,
  defaultOptions: {},
  transformer: (options: AutoMinMaxPerFieldTransformerOptions) => {
    const reducers = [ReducerID.min, ReducerID.max];
    return (data: DataFrame[]) => {
      console.log(data);
      return data.map((frame, _) => {
        const fields: Field[] = frame.fields.map(field => {
          if (field.type === FieldType.number && field.values) {
            console.log(field);
            console.log(field.config);
            const config: FieldConfig = { ...field.config };
            console.log(config);
            if (!isNumber(config.min) || !isNumber(config.max)) {
              const stats = reduceField({ field, reducers });
              config.min = stats[ReducerID.min];
              config.max = stats[ReducerID.max];
            }
            return {
              ...field,
              config,
            };
          } else {
            return field;
          }
        });
        return {
          ...frame,
          fields,
        };
      });
    };
  },
};
