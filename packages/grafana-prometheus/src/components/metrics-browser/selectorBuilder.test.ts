import { buildSelector, facetLabels } from './selectorBuilder';
import { METRIC_LABEL, SelectableLabel } from './types';

describe('selectorBuilder', () => {
  describe('buildSelector', () => {
    it('returns an empty selector for no labels', () => {
      expect(buildSelector([])).toEqual('{}');
    });
    it('returns an empty selector for selected labels with no values', () => {
      const labels: SelectableLabel[] = [{ name: 'foo', selected: true }];
      expect(buildSelector(labels)).toEqual('{}');
    });
    it('returns an empty selector for one selected label with no selected values', () => {
      const labels: SelectableLabel[] = [{ name: 'foo', selected: true, values: [{ name: 'bar' }] }];
      expect(buildSelector(labels)).toEqual('{}');
    });
    it('returns a simple selector from a selected label with a selected value', () => {
      const labels: SelectableLabel[] = [{ name: 'foo', selected: true, values: [{ name: 'bar', selected: true }] }];
      expect(buildSelector(labels)).toEqual('{foo="bar"}');
    });
    it('metric selector without labels', () => {
      const labels: SelectableLabel[] = [
        { name: '__name__', selected: true, values: [{ name: 'foo', selected: true }] },
      ];
      expect(buildSelector(labels)).toEqual('foo{}');
    });
    it('selector with multiple metrics', () => {
      const labels: SelectableLabel[] = [
        {
          name: '__name__',
          selected: true,
          values: [
            { name: 'foo', selected: true },
            { name: 'bar', selected: true },
          ],
        },
      ];
      expect(buildSelector(labels)).toEqual('{__name__=~"foo|bar"}');
    });
    it('metric selector with labels', () => {
      const labels: SelectableLabel[] = [
        { name: '__name__', selected: true, values: [{ name: 'foo', selected: true }] },
        { name: 'bar', selected: true, values: [{ name: 'baz', selected: true }] },
      ];
      expect(buildSelector(labels)).toEqual('foo{bar="baz"}');
    });

    describe('utf8 support', () => {
      it('metric selector with utf8 metric', () => {
        const labels: SelectableLabel[] = [
          { name: '__name__', selected: true, values: [{ name: 'utf8.metric', selected: true }] },
        ];
        expect(buildSelector(labels)).toEqual('{"utf8.metric"}');
      });

      it('metric selector with utf8 labels', () => {
        const labels: SelectableLabel[] = [
          { name: '__name__', selected: true, values: [{ name: 'foo', selected: true }] },
          { name: 'utf8.label', selected: true, values: [{ name: 'baz', selected: true }] },
        ];
        expect(buildSelector(labels)).toEqual('foo{"utf8.label"="baz"}');
      });

      it('metric selector with utf8 labels and metrics', () => {
        const labels: SelectableLabel[] = [
          { name: '__name__', selected: true, values: [{ name: 'utf8.metric', selected: true }] },
          { name: 'utf8.label', selected: true, values: [{ name: 'baz', selected: true }] },
        ];
        expect(buildSelector(labels)).toEqual('{"utf8.metric","utf8.label"="baz"}');
      });

      it('metric selector with utf8 metric and with utf8/non-utf8 labels', () => {
        const labels: SelectableLabel[] = [
          { name: '__name__', selected: true, values: [{ name: 'utf8.metric', selected: true }] },
          { name: 'utf8.label', selected: true, values: [{ name: 'uuu', selected: true }] },
          { name: 'bar', selected: true, values: [{ name: 'baz', selected: true }] },
        ];
        expect(buildSelector(labels)).toEqual('{"utf8.metric","utf8.label"="uuu",bar="baz"}');
      });

      it('metric selector with non-utf8 metric with utf8/non-utf8 labels', () => {
        const labels: SelectableLabel[] = [
          { name: '__name__', selected: true, values: [{ name: 'foo', selected: true }] },
          { name: 'utf8.label', selected: true, values: [{ name: 'uuu', selected: true }] },
          { name: 'bar', selected: true, values: [{ name: 'baz', selected: true }] },
        ];
        expect(buildSelector(labels)).toEqual('foo{"utf8.label"="uuu",bar="baz"}');
      });
    });

    it('should return empty selector when no labels are selected', () => {
      const labels: SelectableLabel[] = [];
      expect(buildSelector(labels)).toBe('{}');
    });

    it('should return empty selector when no values are selected', () => {
      const labels: SelectableLabel[] = [
        {
          name: 'job',
          selected: true,
          values: [
            { name: 'prometheus', selected: false },
            { name: 'node_exporter', selected: false },
          ],
        },
      ];
      expect(buildSelector(labels)).toBe('{}');
    });

    it('should build selector with a single metric', () => {
      const labels: SelectableLabel[] = [
        {
          name: METRIC_LABEL,
          values: [{ name: 'http_requests_total', selected: true }],
        },
      ];
      expect(buildSelector(labels)).toBe('http_requests_total{}');
    });

    it('should build selector with a single label', () => {
      const labels: SelectableLabel[] = [
        {
          name: 'job',
          selected: true,
          values: [{ name: 'prometheus', selected: true }],
        },
      ];
      expect(buildSelector(labels)).toBe('{job="prometheus"}');
    });

    it('should build selector with a metric and a label', () => {
      const labels: SelectableLabel[] = [
        {
          name: METRIC_LABEL,
          values: [{ name: 'http_requests_total', selected: true }],
        },
        {
          name: 'job',
          selected: true,
          values: [{ name: 'prometheus', selected: true }],
        },
      ];
      expect(buildSelector(labels)).toBe('http_requests_total{job="prometheus"}');
    });

    it('should build selector with multiple label values using regex', () => {
      const labels: SelectableLabel[] = [
        {
          name: 'job',
          selected: true,
          values: [
            { name: 'prometheus', selected: true },
            { name: 'node_exporter', selected: true },
          ],
        },
      ];
      expect(buildSelector(labels)).toBe('{job=~"prometheus|node_exporter"}');
    });

    it('should build selector with multiple labels', () => {
      const labels: SelectableLabel[] = [
        {
          name: METRIC_LABEL,
          values: [{ name: 'http_requests_total', selected: true }],
        },
        {
          name: 'job',
          selected: true,
          values: [{ name: 'prometheus', selected: true }],
        },
        {
          name: 'instance',
          selected: true,
          values: [{ name: 'localhost:9090', selected: true }],
        },
      ];
      expect(buildSelector(labels)).toBe('http_requests_total{job="prometheus",instance="localhost:9090"}');
    });

    it('should build selector with a mix of single and multiple values', () => {
      const labels: SelectableLabel[] = [
        {
          name: METRIC_LABEL,
          values: [{ name: 'http_requests_total', selected: true }],
        },
        {
          name: 'job',
          selected: true,
          values: [
            { name: 'prometheus', selected: true },
            { name: 'node_exporter', selected: true },
          ],
        },
        {
          name: 'instance',
          selected: true,
          values: [{ name: 'localhost:9090', selected: true }],
        },
      ];
      expect(buildSelector(labels)).toBe(
        'http_requests_total{job=~"prometheus|node_exporter",instance="localhost:9090"}'
      );
    });

    it('should handle non-legacy metric names with quotes', () => {
      const labels: SelectableLabel[] = [
        {
          name: METRIC_LABEL,
          values: [{ name: 'metric-with-dashes', selected: true }],
        },
      ];
      expect(buildSelector(labels)).toBe('{"metric-with-dashes"}');
    });

    it('should handle non-legacy metric names with labels', () => {
      const labels: SelectableLabel[] = [
        {
          name: METRIC_LABEL,
          values: [{ name: 'metric-with-dashes', selected: true }],
        },
        {
          name: 'job',
          selected: true,
          values: [{ name: 'prometheus', selected: true }],
        },
      ];
      expect(buildSelector(labels)).toBe('{"metric-with-dashes",job="prometheus"}');
    });

    it('should ignore unselected labels', () => {
      const labels: SelectableLabel[] = [
        {
          name: METRIC_LABEL,
          values: [{ name: 'http_requests_total', selected: true }],
        },
        {
          name: 'job',
          selected: true,
          values: [{ name: 'prometheus', selected: true }],
        },
        {
          name: 'instance',
          selected: false,
          values: [{ name: 'localhost:9090', selected: true }],
        },
      ];
      expect(buildSelector(labels)).toBe('http_requests_total{job="prometheus"}');
    });

    it('should ignore labels with no selected values', () => {
      const labels: SelectableLabel[] = [
        {
          name: METRIC_LABEL,
          values: [{ name: 'http_requests_total', selected: true }],
        },
        {
          name: 'job',
          selected: true,
          values: [{ name: 'prometheus', selected: false }],
        },
      ];
      expect(buildSelector(labels)).toBe('http_requests_total{}');
    });

    it('should handle special characters in label values', () => {
      const labels: SelectableLabel[] = [
        {
          name: 'job',
          selected: true,
          values: [{ name: 'value with spaces', selected: true }],
        },
        {
          name: 'instance',
          selected: true,
          values: [{ name: 'host:with:colons', selected: true }],
        },
      ];
      expect(buildSelector(labels)).toBe('{job="value with spaces",instance="host:with:colons"}');
    });

    it('should handle empty string values', () => {
      const labels: SelectableLabel[] = [
        {
          name: 'job',
          selected: true,
          values: [{ name: '', selected: true }],
        },
      ];
      expect(buildSelector(labels)).toBe('{job=""}');
    });

    it('should handle multiple metrics with some unselected', () => {
      const labels: SelectableLabel[] = [
        {
          name: METRIC_LABEL,
          values: [
            { name: 'metric1', selected: true },
            { name: 'metric2', selected: true },
            { name: 'metric3', selected: false },
          ],
        },
      ];
      expect(buildSelector(labels)).toBe('{__name__=~"metric1|metric2"}');
    });

    it('should handle Unicode characters in label names and values', () => {
      const labels: SelectableLabel[] = [
        {
          name: 'région',
          selected: true,
          values: [{ name: 'París', selected: true }],
        },
        {
          name: '环境',
          selected: true,
          values: [{ name: '测试', selected: true }],
        },
      ];
      expect(buildSelector(labels)).toBe('{"région"="París","环境"="测试"}');
    });
  });

  describe('facetLabels()', () => {
    const possibleLabels = {
      cluster: ['dev'],
      namespace: ['alertmanager'],
    };
    const labels: SelectableLabel[] = [
      { name: 'foo', selected: true, values: [{ name: 'bar' }] },
      { name: 'cluster', values: [{ name: 'dev' }, { name: 'ops' }, { name: 'prod' }] },
      { name: 'namespace', values: [{ name: 'alertmanager' }] },
    ];

    it('returns no labels given an empty label set', () => {
      expect(facetLabels([], {})).toEqual([]);
    });

    it('marks all labels as hidden when no labels are possible', () => {
      const result = facetLabels(labels, {});
      expect(result.length).toEqual(labels.length);
      expect(result[0].hidden).toBeTruthy();
      expect(result[0].values).toBeUndefined();
    });

    it('keeps values as facetted when they are possible', () => {
      const result = facetLabels(labels, possibleLabels);
      expect(result.length).toEqual(labels.length);
      expect(result[0].hidden).toBeTruthy();
      expect(result[0].values).toBeUndefined();
      expect(result[1].hidden).toBeFalsy();
      expect(result[1].values!.length).toBe(1);
      expect(result[1].values![0].name).toBe('dev');
    });

    it('does not facet out label values that are currently being facetted', () => {
      const result = facetLabels(labels, possibleLabels, 'cluster');
      expect(result.length).toEqual(labels.length);
      expect(result[0].hidden).toBeTruthy();
      expect(result[1].hidden).toBeFalsy();
      // 'cluster' is being facetted, should show all 3 options even though only 1 is possible
      expect(result[1].values!.length).toBe(3);
      expect(result[2].values!.length).toBe(1);
    });

    it('should preserve loading state during facetting', () => {
      const labels: SelectableLabel[] = [
        { name: 'job', selected: true, loading: true },
        { name: 'instance', selected: false },
      ];

      const possibleLabels = {
        job: ['prometheus'],
      };

      const result = facetLabels(labels, possibleLabels);
      expect(result[0].loading).toBe(false); // Loading should be reset after facetting
    });

    it('should handle multiple selected values preservation', () => {
      const labels: SelectableLabel[] = [
        {
          name: 'job',
          selected: true,
          values: [
            { name: 'prometheus', selected: true },
            { name: 'grafana', selected: true },
          ],
        },
      ];

      const possibleLabels = {
        job: ['prometheus', 'grafana', 'loki'],
      };

      const result = facetLabels(labels, possibleLabels);
      const selectedValues = result[0].values?.filter((v) => v.selected).map((v) => v.name);
      expect(selectedValues).toEqual(['prometheus', 'grafana']);
    });

    it('should handle mixed selected/unselected values during facetting', () => {
      const labels: SelectableLabel[] = [
        {
          name: 'job',
          selected: true,
          values: [
            { name: 'prometheus', selected: true },
            { name: 'grafana', selected: false },
            { name: 'loki', selected: true },
          ],
        },
      ];

      const possibleLabels = {
        job: ['prometheus', 'grafana', 'loki', 'tempo'],
      };

      const result = facetLabels(labels, possibleLabels);
      expect(result[0].values?.filter((v) => v.selected).map((v) => v.name)).toEqual(['prometheus', 'loki']);
      expect(result[0].values?.length).toBe(4); // Should include all possible values
    });

    it('should handle zero facets case', () => {
      const labels: SelectableLabel[] = [
        {
          name: 'job',
          selected: true,
          values: [{ name: 'prometheus', selected: true }],
        },
      ];

      const possibleLabels = {
        job: [],
      };

      const result = facetLabels(labels, possibleLabels);
      expect(result[0].facets).toBe(0);
      expect(result[0].hidden).toBe(false); // Should still be visible as it's in possibleLabels
      expect(result[0].values).toEqual([]); // Should have empty values array
    });
  });
});
