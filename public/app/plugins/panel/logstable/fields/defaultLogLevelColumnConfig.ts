import { Field, FieldConfig, FieldType, LogLevel, MappingType, ValueMap } from '@grafana/data';
import { TableCellOptions } from '@grafana/schema';
import { TableCellDisplayMode } from '@grafana/ui';
import { LogLevelColor } from 'app/features/logs/logsModel';

/** Colors match LogLevelColor in logsModel.ts. */
export function buildDefaultLogLevelValueMap(): ValueMap {
  const options: Record<string, { color: string }> = {};
  for (const level in LogLevel) {
    options[level] = { color: LogLevelColor[level] };
    if (level !== LogLevel[level]) {
      options[level].text = LogLevel[level];
    }
  }

  return {
    type: MappingType.ValueToText,
    options,
  };
}

export function getLogLevelColumnEnhancements(
  field: Field,
  levelFieldName: string,
  baseFieldConfig: FieldConfig
) {
  if (field.name !== levelFieldName || field.type !== FieldType.string) {
    return undefined;
  }

  const out: { mappings?: ValueMap[]; cellOptions?: TableCellOptions } = {};

  if (!baseFieldConfig.mappings?.length) {
    out.mappings = [buildDefaultLogLevelValueMap()];
  }

  const cellType = baseFieldConfig.custom?.cellOptions?.type;
  if (cellType === undefined || cellType === TableCellDisplayMode.Auto) {
    out.cellOptions = {
      ...baseFieldConfig.custom?.cellOptions,
      type: TableCellDisplayMode.Pill,
    };
  }

  return Object.keys(out).length ? out : undefined;
}

