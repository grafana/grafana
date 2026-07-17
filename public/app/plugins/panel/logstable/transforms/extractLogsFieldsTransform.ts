import { type DataFrame, DataFrameType, type DataTransformerConfig, type Field, FieldType } from '@grafana/data';

export function extractLogsFieldsTransform(dataFrame: DataFrame): DataTransformerConfig[] {
  // Fields may already have been extracted upstream (e.g. via an "Extract fields"
  // transformation in the panel's transformations). Re-extracting would duplicate
  // the parsed columns, so skip by returning no transforms.
  if (dataFrame?.meta?.custom?.extracted) {
    return [];
  }

  return dataFrame?.fields
    .filter((field: Field & { typeInfo?: { frame: string } }) => {
      const isFieldLokiLabels =
        field.typeInfo?.frame === 'json.RawMessage' &&
        field.name === 'labels' &&
        dataFrame?.meta?.type !== DataFrameType.LogLines;
      const isFieldDataplaneLabels =
        field.name === 'labels' && field.type === FieldType.other && dataFrame?.meta?.type === DataFrameType.LogLines;
      return isFieldLokiLabels || isFieldDataplaneLabels;
    })
    .flatMap((field: Field) => {
      return [
        {
          id: 'extractFields',
          options: {
            format: 'json',
            keepTime: false,
            replace: false,
            source: field.name,
          },
        },
      ];
    });
}
