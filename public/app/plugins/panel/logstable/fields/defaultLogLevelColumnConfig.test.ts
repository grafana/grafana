import { Field, FieldConfig, FieldType, LogLevel, MappingType } from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/ui';
import { LogLevelColor } from 'app/features/logs/logsModel';

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

    it('adds value map and pill cell mode for matching string field', () => {
      const enh = getLogLevelColumnEnhancements(levelField, 'level', {});
      expect(enh?.mappings).toHaveLength(1);
      expect(enh?.mappings?.[0].type).toBe(MappingType.ValueToText);
      expect(enh?.cellOptions?.type).toBe(TableCellDisplayMode.Pill);
    });

    it('skips when field name does not match level column', () => {
      expect(getLogLevelColumnEnhancements({ ...levelField, name: 'service' }, 'level', {})).toBeUndefined();
    });

    it('skips mappings and cell mode when already configured', () => {
      const existing: FieldConfig = {
        mappings: [{ type: MappingType.ValueToText, options: { info: { color: '#111111' } } }],
        custom: { cellOptions: { type: TableCellDisplayMode.ColorText } },
      };
      const enh = getLogLevelColumnEnhancements(levelField, 'level', existing);
      expect(enh).toBeUndefined();
    });
  });
});
