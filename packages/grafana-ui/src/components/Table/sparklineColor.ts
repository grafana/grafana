import { type DataFrame, type Field, type FieldColor, type GrafanaTheme2, getColorByStringHash } from '@grafana/data';
import { FieldColorModeId, TableSparklineColorMode, type TableSparklineCellOptions } from '@grafana/schema';

export function getSparklineColor(
  field: Field,
  rowIndex: number,
  frame: DataFrame | undefined,
  cellOptions: TableSparklineCellOptions,
  theme: GrafanaTheme2
): FieldColor | undefined {
  if (cellOptions.sparklineColorMode !== TableSparklineColorMode.ByFieldValue) {
    return field.config.color;
  }

  const key = getRowBasedSparklineColorKey(frame, rowIndex, cellOptions.sparklineColorField);
  if (key === undefined) {
    return field.config.color;
  }

  const paletteColor = getColorByStringHash(theme.visualization.palette, key);
  return {
    mode: FieldColorModeId.Fixed,
    fixedColor: theme.visualization.getColorByName(paletteColor),
  };
}

export function getRowBasedSparklineColorKey(
  frame: DataFrame | undefined,
  rowIndex: number,
  sourceFieldName: string | undefined
): string | undefined {
  if (!frame || !sourceFieldName) {
    return undefined;
  }

  const sourceField = frame.fields.find(
    (field) => field.name === sourceFieldName || field.state?.displayName === sourceFieldName
  );
  const sourceValue = sourceField?.values[rowIndex];

  if (sourceValue == null) {
    return undefined;
  }

  if (sourceValue instanceof Date) {
    return sourceValue.toISOString();
  }

  switch (typeof sourceValue) {
    case 'string':
      return sourceValue;
    case 'number':
    case 'boolean':
    case 'bigint':
      return String(sourceValue);
    case 'object':
      return stringifyObjectValue(sourceValue);
    default:
      return undefined;
  }
}

function stringifyObjectValue(value: object): string | undefined {
  try {
    const result = JSON.stringify(value);
    return result === undefined ? undefined : result;
  } catch {
    return undefined;
  }
}
