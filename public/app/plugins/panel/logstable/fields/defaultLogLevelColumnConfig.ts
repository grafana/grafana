import { LogLevel, MappingType, type ValueMap } from '@grafana/data';
import { type Field, type FieldConfig, FieldType } from '@grafana/data/dataframe';
import { type TableCellOptions, type ValueMappingResult } from '@grafana/schema';
import { TableCellDisplayMode } from '@grafana/ui';
import { LogLevelColor } from 'app/features/logs/logsModel';

import { DEFAULT_LOG_LEVEL_FIELD_WIDTH } from '../constants';

/** Colors match LogLevelColor in logsModel.ts. */
export function buildDefaultLogLevelValueMap(): ValueMap {
  const options: Record<string, ValueMappingResult> = {};
  for (const level in LogLevel) {
    const canonicLevel: LogLevel | undefined = levelIsLogLevel(level) ? LogLevel[level] : undefined;
    if (!canonicLevel) {
      continue;
    }
    options[level] = { color: LogLevelColor[canonicLevel] };
    if (level !== canonicLevel) {
      options[level].text = canonicLevel;
    }
  }

  return {
    type: MappingType.ValueToText,
    options,
  };
}

export function getLogLevelColumnEnhancements(field: Field, levelFieldName: string, baseFieldConfig: FieldConfig) {
  if (field.name !== levelFieldName || field.type !== FieldType.string) {
    return undefined;
  }

  const out: { mappings?: ValueMap[]; cellOptions?: TableCellOptions; width?: number } = {};

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

  if (baseFieldConfig.custom?.width === undefined) {
    out.width = DEFAULT_LOG_LEVEL_FIELD_WIDTH;
  }

  return Object.keys(out).length ? out : undefined;
}

function levelIsLogLevel(level: unknown): level is keyof typeof LogLevel {
  return typeof level === 'string' && level in LogLevel;
}
