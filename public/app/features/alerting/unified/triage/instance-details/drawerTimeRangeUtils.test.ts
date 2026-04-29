import { type TimeRange, dateTime } from '@grafana/data';
import type { GrafanaRuleDefinition } from 'app/types/unified-alerting-dto';

import { getMaxQueryEvaluationWindowSeconds, isDrawerRangeShorterThanQuery } from './drawerTimeRangeUtils';

function dataQuery(relativeTimeRange: { from: number; to: number }) {
  return {
    refId: 'A',
    queryType: 'prometheus',
    datasourceUid: 'ds1',
    model: { expr: 'up' },
    relativeTimeRange,
  };
}

function makeTimeRange(fromMs: number, toMs: number): TimeRange {
  const from = dateTime(fromMs);
  const to = dateTime(toMs);
  return { from, to, raw: { from, to } };
}

describe('drawerTimeRangeUtils', () => {
  describe('getMaxQueryEvaluationWindowSeconds', () => {
    it('returns 0 when rule has no data', () => {
      const rule = { data: [] } as unknown as GrafanaRuleDefinition;
      expect(getMaxQueryEvaluationWindowSeconds(rule)).toBe(0);
    });

    it('returns 0 when rule has no data queries with relativeTimeRange', () => {
      const rule = {
        data: [
          {
            refId: 'B',
            queryType: 'expression',
            datasourceUid: '__expr',
            model: { type: 'math', expression: '1' },
            // no relativeTimeRange
          },
        ],
      } as unknown as GrafanaRuleDefinition;
      expect(getMaxQueryEvaluationWindowSeconds(rule)).toBe(0);
    });

    it('returns max from when data queries have relativeTimeRange', () => {
      const rule = {
        data: [dataQuery({ from: 300, to: 0 }), dataQuery({ from: 600, to: 0 }), dataQuery({ from: 400, to: 0 })],
      } as unknown as GrafanaRuleDefinition;
      expect(getMaxQueryEvaluationWindowSeconds(rule)).toBe(600);
    });

    it('mixed: only counts data queries with relativeTimeRange', () => {
      const rule = {
        data: [
          dataQuery({ from: 900, to: 0 }),
          { refId: 'B', queryType: 'prometheus', datasourceUid: 'ds', model: { expr: 'up' } }, // no relativeTimeRange
          dataQuery({ from: 300, to: 0 }),
        ],
      } as unknown as GrafanaRuleDefinition;
      expect(getMaxQueryEvaluationWindowSeconds(rule)).toBe(900);
    });
  });

  describe('isDrawerRangeShorterThanQuery', () => {
    const ruleWith600sWindow = {
      data: [dataQuery({ from: 600, to: 0 })],
    } as unknown as GrafanaRuleDefinition;

    it('returns false when rule has no evaluation window (0)', () => {
      const rule = { data: [dataQuery({ from: 0, to: 0 })] } as unknown as GrafanaRuleDefinition;
      const range = makeTimeRange(0, 100 * 1000);
      expect(isDrawerRangeShorterThanQuery(rule, range)).toBe(false);
    });

    it('returns true when drawer range is shorter than window', () => {
      const range = makeTimeRange(0, 300 * 1000); // 300s
      expect(isDrawerRangeShorterThanQuery(ruleWith600sWindow, range)).toBe(true);
    });

    it('returns false when drawer range equals window', () => {
      const range = makeTimeRange(0, 600 * 1000); // 600s
      expect(isDrawerRangeShorterThanQuery(ruleWith600sWindow, range)).toBe(false);
    });

    it('returns false when drawer range is longer than window', () => {
      const range = makeTimeRange(0, 900 * 1000); // 900s
      expect(isDrawerRangeShorterThanQuery(ruleWith600sWindow, range)).toBe(false);
    });
  });
});
