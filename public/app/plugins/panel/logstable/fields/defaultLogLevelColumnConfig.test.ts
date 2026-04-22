import { type Field, type FieldConfig, FieldType, LogLevel, MappingType } from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/ui';
import { LogLevelColor } from 'app/features/logs/logsModel';

import { DEFAULT_LOG_LEVEL_FIELD_WIDTH } from '../constants';

import { buildDefaultLogLevelValueMap, getLogLevelColumnEnhancements } from './defaultLogLevelColumnConfig';

describe('defaultLogLevelColumnConfig', () => {
  describe('buildDefaultLogLevelValueMap', () => {
    it('maps canonical levels to expected colors', () => {
      const map = buildDefaultLogLevelValueMap();
      expect(map.options[LogLevel.critical]?.color).toBe(LogLevelColor[LogLevel.critical]);
      expect(map.options[LogLevel.error]?.color).toBe(LogLevelColor[LogLevel.error]);
      expect(map.options[LogLevel.warning]?.color).toBe(LogLevelColor[LogLevel.warning]);
    });

    it('maps synonym levels like crit and emerg to critical as visible text', () => {
      const map = buildDefaultLogLevelValueMap();
      expect(LogLevel.crit).toBe(LogLevel.critical);
      expect(LogLevel.emerg).toBe(LogLevel.critical);
      expect(map.options[LogLevel.crit]).toMatchObject({ color: LogLevelColor[LogLevel.critical] });
      expect(map.options[LogLevel.emerg]).toMatchObject({ color: LogLevelColor[LogLevel.critical] });
    });
  });

  describe('getLogLevelColumnEnhancements', () => {
    const levelField: Field = { name: 'level', type: FieldType.string, config: {}, values: [] };

    it('adds value map, pill cell mode, and default width for matching string field', () => {
      const enh = getLogLevelColumnEnhancements(levelField, 'level', {});
      expect(enh?.mappings).toHaveLength(1);
      expect(enh?.mappings?.[0].type).toBe(MappingType.ValueToText);
      expect(enh?.cellOptions?.type).toBe(TableCellDisplayMode.Pill);
      expect(enh?.width).toBe(DEFAULT_LOG_LEVEL_FIELD_WIDTH);
    });

    it('skips when field name does not match level column', () => {
      expect(getLogLevelColumnEnhancements({ ...levelField, name: 'service' }, 'level', {})).toBeUndefined();
    });

    it('skips mappings and cell mode when already configured but still applies default width', () => {
      const existing: FieldConfig = {
        mappings: [{ type: MappingType.ValueToText, options: { info: { color: '#111111' } } }],
        custom: { cellOptions: { type: TableCellDisplayMode.ColorText } },
      };
      const enh = getLogLevelColumnEnhancements(levelField, 'level', existing);
      expect(enh).toEqual({ width: DEFAULT_LOG_LEVEL_FIELD_WIDTH });
    });

    it('skips all enhancements when column width is already set', () => {
      const existing: FieldConfig = {
        mappings: [{ type: MappingType.ValueToText, options: { info: { color: '#111111' } } }],
        custom: { cellOptions: { type: TableCellDisplayMode.ColorText }, width: 200 },
      };
      expect(getLogLevelColumnEnhancements(levelField, 'level', existing)).toBeUndefined();
    });
  });
});
