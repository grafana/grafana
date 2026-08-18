import { type DataFrame, DataFrameType, type DataTransformerConfig, type Field, FieldType } from '@grafana/data';

/**
 * Panel-registered transformations are supplied the whole series at once, while
 * {@link extractLogsFieldsTransform} inspects a single frame. Configs are deduplicated by source
 * field because `transformDataFrame` applies each one to every frame — a second config for the
 * same source would extract the same columns twice, and `extractFields` renames colliding
 * columns rather than skipping them.
 */
export function extractLogsFieldsTransforms(series: DataFrame[]): DataTransformerConfig[] {
  const bySource = new Map<string, DataTransformerConfig>();

  for (const frame of series) {
    for (const config of extractLogsFieldsTransform(frame) ?? []) {
      bySource.set(config.options.source, config);
    }
  }

  return Array.from(bySource.values());
}

export function extractLogsFieldsTransform(dataFrame: DataFrame) {
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
