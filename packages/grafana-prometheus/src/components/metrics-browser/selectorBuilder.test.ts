import { buildSelector_old, buildSelector, facetLabels } from './selectorBuilder';
import { SelectableLabel } from './types';

describe('selectorBuilder', () => {
  describe('buildSelector()', () => {
    it('returns an empty selector for no labels', () => {
      expect(buildSelector('', {})).toEqual('{}');
    });

    it('returns an empty selector for selected labels with no values', () => {
      expect(buildSelector('', {})).toEqual('{}');
    });

    it('returns an empty selector for one selected label with no selected values', () => {
      expect(buildSelector('', {})).toEqual('{}');
    });

    it('returns a simple selector from a selected label with a selected value', () => {
      expect(buildSelector('', { foo: ['bar'] })).toEqual('{foo="bar"}');
    });

    it('metric selector without labels', () => {
      expect(buildSelector('foo', {})).toEqual('foo{}');
    });

    it('metric selector with labels', () => {
      expect(buildSelector('foo', { bar: ['baz'] })).toEqual('foo{bar="baz"}');
    });

    describe('utf8 support', () => {
      it('metric selector with utf8 metric', () => {
        expect(buildSelector('utf8.metric', {})).toEqual('{"utf8.metric"}');
      });

      it('metric selector with utf8 labels', () => {
        expect(buildSelector('foo', { 'utf8.label': ['baz'] })).toEqual('foo{"utf8.label"="baz"}');
      });

      it('metric selector with utf8 labels and metrics', () => {
        expect(buildSelector('utf8.metric', { 'utf8.label': ['baz'] })).toEqual('{"utf8.metric","utf8.label"="baz"}');
      });

      it('metric selector with utf8 metric and with utf8/non-utf8 labels', () => {
        expect(
          buildSelector('utf8.metric', {
            'utf8.label': ['uuu'],
            bar: ['baz'],
          })
        ).toEqual('{"utf8.metric","utf8.label"="uuu",bar="baz"}');
      });

      it('metric selector with non-utf8 metric with utf8/non-utf8 labels', () => {
        expect(
          buildSelector('foo', {
            'utf8.label': ['uuu'],
            bar: ['baz'],
          })
        ).toEqual('foo{"utf8.label"="uuu",bar="baz"}');
      });
    });
  });

  describe('buildSelector_old()', () => {
    it('returns an empty selector for no labels', () => {
      expect(buildSelector_old([])).toEqual('{}');
    });
    it('returns an empty selector for selected labels with no values', () => {
      const labels: SelectableLabel[] = [{ name: 'foo', selected: true }];
      expect(buildSelector_old(labels)).toEqual('{}');
    });
    it('returns an empty selector for one selected label with no selected values', () => {
      const labels: SelectableLabel[] = [{ name: 'foo', selected: true, values: [{ name: 'bar' }] }];
      expect(buildSelector_old(labels)).toEqual('{}');
    });
    it('returns a simple selector from a selected label with a selected value', () => {
      const labels: SelectableLabel[] = [{ name: 'foo', selected: true, values: [{ name: 'bar', selected: true }] }];
      expect(buildSelector_old(labels)).toEqual('{foo="bar"}');
    });
    it('metric selector without labels', () => {
      const labels: SelectableLabel[] = [
        { name: '__name__', selected: true, values: [{ name: 'foo', selected: true }] },
      ];
      expect(buildSelector_old(labels)).toEqual('foo{}');
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
      expect(buildSelector_old(labels)).toEqual('{__name__=~"foo|bar"}');
    });
    it('metric selector with labels', () => {
      const labels: SelectableLabel[] = [
        { name: '__name__', selected: true, values: [{ name: 'foo', selected: true }] },
        { name: 'bar', selected: true, values: [{ name: 'baz', selected: true }] },
      ];
      expect(buildSelector_old(labels)).toEqual('foo{bar="baz"}');
    });

    describe('utf8 support', () => {
      it('metric selector with utf8 metric', () => {
        const labels: SelectableLabel[] = [
          { name: '__name__', selected: true, values: [{ name: 'utf8.metric', selected: true }] },
        ];
        expect(buildSelector_old(labels)).toEqual('{"utf8.metric"}');
      });

      it('metric selector with utf8 labels', () => {
        const labels: SelectableLabel[] = [
          { name: '__name__', selected: true, values: [{ name: 'foo', selected: true }] },
          { name: 'utf8.label', selected: true, values: [{ name: 'baz', selected: true }] },
        ];
        expect(buildSelector_old(labels)).toEqual('foo{"utf8.label"="baz"}');
      });

      it('metric selector with utf8 labels and metrics', () => {
        const labels: SelectableLabel[] = [
          { name: '__name__', selected: true, values: [{ name: 'utf8.metric', selected: true }] },
          { name: 'utf8.label', selected: true, values: [{ name: 'baz', selected: true }] },
        ];
        expect(buildSelector_old(labels)).toEqual('{"utf8.metric","utf8.label"="baz"}');
      });

      it('metric selector with utf8 metric and with utf8/non-utf8 labels', () => {
        const labels: SelectableLabel[] = [
          { name: '__name__', selected: true, values: [{ name: 'utf8.metric', selected: true }] },
          { name: 'utf8.label', selected: true, values: [{ name: 'uuu', selected: true }] },
          { name: 'bar', selected: true, values: [{ name: 'baz', selected: true }] },
        ];
        expect(buildSelector_old(labels)).toEqual('{"utf8.metric","utf8.label"="uuu",bar="baz"}');
      });

      it('metric selector with non-utf8 metric with utf8/non-utf8 labels', () => {
        const labels: SelectableLabel[] = [
          { name: '__name__', selected: true, values: [{ name: 'foo', selected: true }] },
          { name: 'utf8.label', selected: true, values: [{ name: 'uuu', selected: true }] },
          { name: 'bar', selected: true, values: [{ name: 'baz', selected: true }] },
        ];
        expect(buildSelector_old(labels)).toEqual('foo{"utf8.label"="uuu",bar="baz"}');
      });
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
