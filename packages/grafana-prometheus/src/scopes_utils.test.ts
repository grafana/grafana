import { Scope } from '@grafana/data';

import { scopesFiltersToPrometheusFilters, scopesToPrometheusFilters } from './scopes_utils';

const scopes: Scope[] = [
  {
    metadata: {
      name: 'scope1',
    },
    spec: {
      title: 'scope1',
      type: 'scope',
      description: '',
      category: '',
      filters: [
        {
          key: 'key1',
          value: 'value1',
          operator: 'equals',
        },
        {
          key: 'key2',
          value: 'value2',
          operator: 'not-equals',
        },
        {
          key: 'key3',
          value: 'value3',
          operator: 'regex-match',
        },
        {
          key: 'key4',
          value: 'value4',
          operator: 'regex-not-match',
        },
        {
          key: 'key5',
          value: 'value5',
          operator: 'one-of',
          values: ['value5', 'value6'],
        },
        {
          key: 'key6',
          value: 'value6',
          operator: 'not-one-of',
          values: ['value7', 'value8'],
        },
      ],
    },
  },
  {
    metadata: {
      name: 'scope2',
    },
    spec: {
      title: 'scope2',
      type: 'scope',
      description: '',
      category: '',
      filters: [
        {
          key: 'key7',
          value: 'value7',
          operator: 'equals',
        },
      ],
    },
  },
];

const expectedFilters = [
  [
    {
      label: 'key1',
      value: 'value1',
      op: '=',
    },
    {
      label: 'key2',
      value: 'value2',
      op: '!=',
    },
    {
      label: 'key3',
      value: 'value3',
      op: '=~',
    },
    {
      label: 'key4',
      value: 'value4',
      op: '!~',
    },
    {
      label: 'key5',
      value: 'value5',
      op: '=|',
    },
    {
      label: 'key6',
      value: 'value6',
      op: '!=|',
    },
  ],
  {
    label: 'key7',
    value: 'value7',
    op: '=',
  },
];

describe('scopesFiltersToPrometheusFilters()', () => {
  it('Returns the list of filters in the correct format', () => {
    expect(scopesFiltersToPrometheusFilters(scopes[0].spec.filters)).toEqual(expectedFilters[0]);
  });
});

describe('scopesToPrometheusFilters()', () => {
  it('Returns the list of filters in the correct format', () => {
    expect(scopesToPrometheusFilters(scopes)).toEqual(expectedFilters.flat());
  });
});
