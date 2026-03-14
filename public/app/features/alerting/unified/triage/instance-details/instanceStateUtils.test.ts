import { renderHook } from '@testing-library/react';

import { FieldType } from '@grafana/data';

import {
  buildInstanceStateQueryExpr,
  getInstanceStateFromMetricSeries,
  useInstanceAlertState,
} from './instanceStateUtils';

jest.mock('../constants', () => ({
  DATASOURCE_UID: 'test-ds-uid',
  METRIC_NAME: 'GRAFANA_ALERTS',
}));

const mockUseQueryRunner = jest.fn();
jest.mock('@grafana/scenes-react', () => ({
  useQueryRunner: (opts: unknown) => mockUseQueryRunner(opts),
}));

describe('instanceStateUtils', () => {
  beforeEach(() => {
    mockUseQueryRunner.mockReset();
    mockUseQueryRunner.mockReturnValue({ useState: () => ({ data: { series: [] } }) });
  });
  describe('buildInstanceStateQueryExpr', () => {
    it('includes grafana_rule_uid and metric name', () => {
      const expr = buildInstanceStateQueryExpr('rule-1', {});
      expect(expr).toBe('GRAFANA_ALERTS{grafana_rule_uid="rule-1"}');
    });

    it('includes non-empty instance labels and excludes __-prefixed keys', () => {
      const expr = buildInstanceStateQueryExpr('r2', {
        team: 'platform',
        __internal: 'skip',
        env: 'prod',
      });
      expect(expr).toContain('grafana_rule_uid="r2"');
      expect(expr).toContain('team="platform"');
      expect(expr).toContain('env="prod"');
      expect(expr).not.toContain('__internal');
    });

    it('excludes empty string and null/undefined values', () => {
      const expr = buildInstanceStateQueryExpr('r3', {
        a: 'x',
        b: '',
        c: null as unknown as string,
        d: undefined as unknown as string,
      });
      expect(expr).toBe('GRAFANA_ALERTS{grafana_rule_uid="r3",a="x"}');
    });

    it('escapes backslash and double-quote in rule UID and label values', () => {
      const expr = buildInstanceStateQueryExpr('rule\\with"quotes', { label: 'val\\ue"here' });
      expect(expr).toContain('grafana_rule_uid="rule\\\\with\\"quotes"');
      expect(expr).toContain('label="val\\\\ue\\"here"');
    });
  });

  describe('getInstanceStateFromMetricSeries', () => {
    function makeSeries(grafana_alertstate: string) {
      const valueField = {
        name: 'Value',
        type: FieldType.number,
        values: [1],
        config: {},
        labels: { grafana_alertstate },
      };
      return [
        {
          fields: [{ name: 'Time', type: FieldType.time, values: [1000], config: {} }, valueField],
          length: 1,
        },
      ];
    }

    it('returns null when series is undefined or empty', () => {
      expect(getInstanceStateFromMetricSeries(undefined)).toBe(null);
      expect(getInstanceStateFromMetricSeries([])).toBe(null);
    });

    it('returns "nodata" when grafana_alertstate is nodata', () => {
      expect(getInstanceStateFromMetricSeries(makeSeries('nodata'))).toBe('nodata');
      expect(getInstanceStateFromMetricSeries(makeSeries('NoData'))).toBe('nodata');
    });

    it('returns "error" when grafana_alertstate is error', () => {
      expect(getInstanceStateFromMetricSeries(makeSeries('error'))).toBe('error');
      expect(getInstanceStateFromMetricSeries(makeSeries('Error'))).toBe('error');
    });

    it('returns null for other states (alerting, pending, recovering)', () => {
      expect(getInstanceStateFromMetricSeries(makeSeries('alerting'))).toBe(null);
      expect(getInstanceStateFromMetricSeries(makeSeries('pending'))).toBe(null);
      expect(getInstanceStateFromMetricSeries(makeSeries('recovering'))).toBe(null);
    });

    it('returns null when value field has no grafana_alertstate label', () => {
      const series = [
        {
          fields: [
            { name: 'Time', type: FieldType.time, values: [1000], config: {} },
            { name: 'Value', type: FieldType.number, values: [1], config: {}, labels: {} },
          ],
          length: 1,
        },
      ];
      expect(getInstanceStateFromMetricSeries(series)).toBe(null);
    });

    it('returns null when there is no non-time field', () => {
      const series = [
        {
          fields: [{ name: 'Time', type: FieldType.time, values: [1000], config: {} }],
          length: 1,
        },
      ];
      expect(getInstanceStateFromMetricSeries(series)).toBe(null);
    });
  });

  describe('useInstanceAlertState', () => {
    it('returns null when query runner has no series', () => {
      mockUseQueryRunner.mockReturnValue({
        useState: () => ({ data: { series: [] } }),
      });
      const { result } = renderHook(() => useInstanceAlertState('rule-1', {}));
      expect(result.current).toBe(null);
    });

    it('returns nodata when series has grafana_alertstate nodata', () => {
      mockUseQueryRunner.mockReturnValue({
        useState: () => ({
          data: {
            series: [
              {
                fields: [
                  { name: 'Time', type: FieldType.time, values: [1000], config: {} },
                  {
                    name: 'Value',
                    type: FieldType.number,
                    values: [1],
                    config: {},
                    labels: { grafana_alertstate: 'nodata' },
                  },
                ],
                length: 1,
              },
            ],
          },
        }),
      });
      const { result } = renderHook(() => useInstanceAlertState('rule-1', {}));
      expect(result.current).toBe('nodata');
    });

    it('returns error when series has grafana_alertstate error', () => {
      mockUseQueryRunner.mockReturnValue({
        useState: () => ({
          data: {
            series: [
              {
                fields: [
                  { name: 'Time', type: FieldType.time, values: [1000], config: {} },
                  {
                    name: 'Value',
                    type: FieldType.number,
                    values: [1],
                    config: {},
                    labels: { grafana_alertstate: 'error' },
                  },
                ],
                length: 1,
              },
            ],
          },
        }),
      });
      const { result } = renderHook(() => useInstanceAlertState('rule-1', {}));
      expect(result.current).toBe('error');
    });
  });
});
