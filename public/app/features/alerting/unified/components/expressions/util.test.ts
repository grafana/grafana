import { DataFrame, FieldType, toDataFrame } from '@grafana/data';
import { CombinedRuleNamespace } from 'app/types/unified-alerting';

import { mockDataSource } from '../../mocks';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import {
  decodeGrafanaNamespace,
  encodeGrafanaNamespace,
  formatLabels,
  getSeriesLabels,
  getSeriesName,
  getSeriesValue,
  isEmptySeries,
} from './util';

const EMPTY_FRAME: DataFrame = toDataFrame([]);
const NAMED_FRAME: DataFrame = {
  name: 'MyFrame',
  ...toDataFrame([]),
};

const DATA_FRAME: DataFrame = toDataFrame({
  fields: [{ name: 'value', type: FieldType.number, values: [1, 2, 3] }],
});

const DATA_FRAME_LARGE_DECIMAL: DataFrame = toDataFrame({
  fields: [{ name: 'value', type: FieldType.number, values: [1.23456789] }],
});

const DATA_FRAME_WITH_LABELS: DataFrame = toDataFrame({
  fields: [{ name: 'value', type: FieldType.number, values: [1, 2, 3], labels: { __name__: 'my-series', foo: 'bar' } }],
});

describe('formatLabels', () => {
  it('should work with no labels', () => {
    expect(formatLabels({})).toBe('');
  });

  it('should work with 1 label', () => {
    expect(formatLabels({ foo: 'bar' })).toBe('foo=bar');
  });

  it('should work with multiple labels', () => {
    expect(formatLabels({ foo: 'bar', baz: 'qux' })).toBe('foo=bar, baz=qux');
  });
});

describe('decodeGrafanaNamespace', () => {
  it('should work for regular Grafana namespaces', () => {
    const grafanaNamespace: CombinedRuleNamespace = {
      name: `my_rule_namespace`,
      rulesSource: GRAFANA_RULES_SOURCE_NAME,
      groups: [
        {
          name: 'group1',
          rules: [],
          totals: {},
        },
      ],
    };
    expect(decodeGrafanaNamespace(grafanaNamespace)).toHaveProperty('name', 'my_rule_namespace');
    expect(decodeGrafanaNamespace(grafanaNamespace)).toHaveProperty('parents', []);
  });

  it('should work for Grafana namespaces in nested folders format', () => {
    const grafanaNamespace: CombinedRuleNamespace = {
      name: `["parentUID","my_rule_namespace"]`,
      rulesSource: GRAFANA_RULES_SOURCE_NAME,
      groups: [
        {
          name: 'group1',
          rules: [],
          totals: {},
        },
      ],
    };

    expect(decodeGrafanaNamespace(grafanaNamespace)).toHaveProperty('name', 'my_rule_namespace');
    expect(decodeGrafanaNamespace(grafanaNamespace)).toHaveProperty('parents', ['parentUID']);
  });

  it('should default to name if format is invalid: invalid JSON', () => {
    const grafanaNamespace: CombinedRuleNamespace = {
      name: `["parentUID"`,
      rulesSource: GRAFANA_RULES_SOURCE_NAME,
      groups: [
        {
          name: 'group1',
          rules: [],
          totals: {},
        },
      ],
    };

    expect(decodeGrafanaNamespace(grafanaNamespace)).toHaveProperty('name', `["parentUID"`);
    expect(decodeGrafanaNamespace(grafanaNamespace)).toHaveProperty('parents', []);
  });

  it('should default to name if format is invalid: empty array', () => {
    const grafanaNamespace: CombinedRuleNamespace = {
      name: `[]`,
      rulesSource: GRAFANA_RULES_SOURCE_NAME,
      groups: [
        {
          name: 'group1',
          rules: [],
          totals: {},
        },
      ],
    };

    expect(decodeGrafanaNamespace(grafanaNamespace)).toHaveProperty('name', `[]`);
    expect(decodeGrafanaNamespace(grafanaNamespace)).toHaveProperty('parents', []);
  });

  it('grab folder name if format is long array', () => {
    const grafanaNamespace: CombinedRuleNamespace = {
      name: `["parentUID","my_rule_namespace","another_part"]`,
      rulesSource: GRAFANA_RULES_SOURCE_NAME,
      groups: [
        {
          name: 'group1',
          rules: [],
          totals: {},
        },
      ],
    };

    expect(decodeGrafanaNamespace(grafanaNamespace)).toHaveProperty('name', 'another_part');
    expect(decodeGrafanaNamespace(grafanaNamespace)).toHaveProperty('parents', ['parentUID', 'my_rule_namespace']);
  });

  it('should not change output for cloud namespaces', () => {
    const cloudNamespace: CombinedRuleNamespace = {
      name: `["parentUID","my_rule_namespace"]`,
      rulesSource: mockDataSource(),
      groups: [
        {
          name: 'Prom group',
          rules: [],
          totals: {},
        },
      ],
    };

    expect(decodeGrafanaNamespace(cloudNamespace)).toHaveProperty('name', `["parentUID","my_rule_namespace"]`);
    expect(decodeGrafanaNamespace(cloudNamespace)).toHaveProperty('parents', []);
  });
});

describe('encodeGrafanaNamespace', () => {
  it('should encode with parents', () => {
    const name = 'folder';
    const parents = ['1', '2', '3'];

    expect(encodeGrafanaNamespace(name, parents)).toBe(`["1","2","3","folder"]`);
  });

  it('should encode without parents', () => {
    const name = 'folder';

    expect(encodeGrafanaNamespace(name)).toBe(`["folder"]`);
  });
});

describe('isEmptySeries', () => {
  it('should be true for empty series', () => {
    expect(isEmptySeries([EMPTY_FRAME])).toBe(true);
    expect(isEmptySeries([EMPTY_FRAME, EMPTY_FRAME])).toBe(true);

    expect(isEmptySeries([DATA_FRAME])).toBe(false);
    expect(isEmptySeries([EMPTY_FRAME, DATA_FRAME])).toBe(false);
  });
});

describe('getSeriesName', () => {
  it('should work with named data frame', () => {
    const name = getSeriesName(NAMED_FRAME);
    expect(name).toBe('MyFrame');
  });

  it('should work with empty data frame', () => {
    expect(getSeriesName(EMPTY_FRAME)).toBe(undefined);
  });

  it('should work with __name__ labeled frame', () => {
    const name = getSeriesName(DATA_FRAME_WITH_LABELS);
    expect(name).toBe('my-series');
  });

  it('should work with NoData frames', () => {
    expect(getSeriesName(EMPTY_FRAME)).toBe(undefined);
  });

  it('should give preference to displayNameFromDS', () => {
    const frame: DataFrame = {
      name: 'MyFrame',
      ...toDataFrame({
        fields: [
          {
            name: 'value',
            type: FieldType.number,
            values: [1, 2, 3],
            labels: { foo: 'bar' },
            config: { displayNameFromDS: 'series-name-override' },
          },
        ],
      }),
    };

    expect(getSeriesName(frame)).toBe('series-name-override');
  });
});

describe('getSeriesValue', () => {
  it('should work with empty data frame', () => {
    expect(getSeriesValue(EMPTY_FRAME)).toBe(undefined);
  });

  it('should work with data frame', () => {
    const name = getSeriesValue(DATA_FRAME);
    expect(name).toBe(1);
  });

  it('should round values', () => {
    expect(getSeriesValue(DATA_FRAME_LARGE_DECIMAL)).toBe(1.23457);
  });
});

describe('getSeriesLabels', () => {
  it('should work for dataframe with labels', () => {
    expect(getSeriesLabels(DATA_FRAME_WITH_LABELS)).toStrictEqual({ __name__: 'my-series', foo: 'bar' });
  });

  it('should work for dataframe with no labels', () => {
    expect(getSeriesLabels(EMPTY_FRAME)).toStrictEqual({});
  });
});
