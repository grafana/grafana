import { MutableDataFrame } from '../../../dataframe';
import { DataFrame, FieldType, Field } from '../../../types/dataFrame';
import { ArrayVector } from '../../../vector';
import { omit } from 'lodash';

interface DataFrameBuilderResult {
  dataFrame: MutableDataFrame;
  valueMapper: ValueMapper;
}

type ValueMapper = (frame: DataFrame, valueIndex: number, timeIndex: number) => Record<string, any>;

export class DataFrameBuilder {
  private isOnlyTimeSeries: boolean;
  private displayMetricField: boolean;
  private valueFields: Record<string, Field>;
  private timeField: Field | null;

  constructor() {
    this.isOnlyTimeSeries = true;
    this.displayMetricField = false;
    this.valueFields = {};
    this.timeField = null;
  }

  addFields(frame: DataFrame, timeIndex: number): void {
    if (frame.fields.length > 2) {
      this.isOnlyTimeSeries = false;
    }

    if (frame.fields.length === 2) {
      this.displayMetricField = true;
    }

    for (let index = 0; index < frame.fields.length; index++) {
      const field = frame.fields[index];

      if (index === timeIndex) {
        if (!this.timeField) {
          this.timeField = this.copyStructure(field, 'time');
        }
        continue;
      }

      if (!this.valueFields[field.name]) {
        this.valueFields[field.name] = this.copyStructure(field, field.name);
      }
    }
  }

  build(): DataFrameBuilderResult {
    return {
      dataFrame: this.createDataFrame(),
      valueMapper: this.createValueMapper(),
    };
  }

  private createValueMapper(): ValueMapper {
    return (frame: DataFrame, valueIndex: number, timeIndex: number) => {
      return frame.fields.reduce((values: Record<string, any>, field, index) => {
        const value = field.values.get(valueIndex);

        if (index === timeIndex) {
          values['time'] = value;

          if (this.displayMetricField) {
            values['metric'] = `${frame.name}-series`;
          }
          return values;
        }

        if (this.isOnlyTimeSeries) {
          values['value'] = value;
          return values;
        }

        values[field.name] = value;
        return values;
      }, {});
    };
  }

  private createDataFrame(): MutableDataFrame {
    const dataFrame = new MutableDataFrame();

    if (this.timeField) {
      dataFrame.addField(this.timeField);

      if (this.displayMetricField) {
        dataFrame.addField({
          name: 'metric',
          type: FieldType.string,
        });
      }
    }

    const valueFields = Object.values(this.valueFields);

    if (this.isOnlyTimeSeries) {
      if (valueFields.length > 0) {
        dataFrame.addField({
          ...valueFields[0],
          name: 'value',
        });
      }

      return dataFrame;
    }

    for (const field of valueFields) {
      dataFrame.addField(field);
    }

    return dataFrame;
  }

  private copyStructure(field: Field, name: string): Field {
    return {
      ...omit(field, ['values', 'name']),
      name,
      values: new ArrayVector(),
    };
  }
}
