import { MutableDataFrame } from '../../../dataframe';
import {
  DataFrame,
  FieldType,
  Field,
  TIME_SERIES_TIME_FIELD_NAME,
  TIME_SERIES_VALUE_FIELD_NAME,
} from '../../../types/dataFrame';
import { ArrayVector } from '../../../vector';
import { omit } from 'lodash';
import { getFrameDisplayName } from '../../../field';

interface DataFrameBuilderResult {
  dataFrame: MutableDataFrame;
  valueMapper: ValueMapper;
}

type ValueMapper = (frame: DataFrame, valueIndex: number, timeIndex: number) => Record<string, any>;

const TIME_SERIES_METRIC_FIELD_NAME = 'Metric';

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
          this.timeField = this.copyStructure(field, TIME_SERIES_TIME_FIELD_NAME);
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
          values[TIME_SERIES_TIME_FIELD_NAME] = value;

          if (this.displayMetricField) {
            values[TIME_SERIES_METRIC_FIELD_NAME] = getFrameDisplayName(frame);
          }
          return values;
        }

        if (this.isOnlyTimeSeries) {
          values[TIME_SERIES_VALUE_FIELD_NAME] = value;
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
          name: TIME_SERIES_METRIC_FIELD_NAME,
          type: FieldType.string,
        });
      }
    }

    const valueFields = Object.values(this.valueFields);

    if (this.isOnlyTimeSeries) {
      if (valueFields.length > 0) {
        dataFrame.addField({
          ...valueFields[0],
          name: TIME_SERIES_VALUE_FIELD_NAME,
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
      ...omit(field, ['values', 'name', 'state', 'labels', 'config']),
      name,
      values: new ArrayVector(),
      config: {
        ...omit(field.config, 'displayName'),
      },
    };
  }
}
