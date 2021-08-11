import {
  ArrayVector,
  DataFrame,
  DataTransformerID,
  DataTransformerInfo,
  Labels,
  MutableDataFrame,
} from '@grafana/data';
import { map } from 'rxjs/operators';

export interface FieldsToLabelsTransformOptions {
  labelFields?: string[];
}

export const fieldsToLabelsTransformer: DataTransformerInfo<FieldsToLabelsTransformOptions> = {
  id: DataTransformerID.fieldsToLabels,
  name: 'Fields to rows',
  defaultOptions: {},

  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
        const result: DataFrame[] = [];

        for (const frame of data) {
          const labelFieldIndexes: number[] = [];
          const fieldIndexes: number[] = [];
          let labels: Labels = {};

          for (let fieldIndex = 0; fieldIndex < frame.fields.length; fieldIndex++) {
            const field = frame.fields[fieldIndex];

            if (field.labels != null) {
              labels = { ...labels, ...field.labels };
            }

            if (options.labelFields != null && options.labelFields.includes(field.name)) {
              labelFieldIndexes.push(fieldIndex);
            } else {
              fieldIndexes.push(fieldIndex);
            }
          }

          const framesByLabels: Record<string, MutableDataFrame> = {};

          for (let rowIndex = 0; rowIndex < frame.length; rowIndex++) {
            const rowLabels: Labels = { ...labels };

            for (const fieldIndex of labelFieldIndexes) {
              const field = frame.fields[fieldIndex];

              rowLabels[field.name] = field.values.get(rowIndex);
            }

            const jsonRowLabels = JSON.stringify(rowLabels);
            let rowFrame = framesByLabels[jsonRowLabels];

            if (rowFrame == null) {
              rowFrame = new MutableDataFrame();

              for (const fieldIndex of fieldIndexes) {
                const field = frame.fields[fieldIndex];

                rowFrame.addField({ ...field, values: new ArrayVector(), labels: rowLabels });
              }
            }

            const row: any[] = [];

            for (const fieldIndex of fieldIndexes) {
              const field = frame.fields[fieldIndex];

              row.push(field.values.get(rowIndex));
            }

            rowFrame.appendRow(row);
          }

          for (const labels in framesByLabels) {
            result.push(framesByLabels[labels]);
          }
        }

        return result;
      })
    ),
};
