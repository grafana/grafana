import React from 'react';
import { InfluxQuery } from '../../types';
import InfluxDatasource from '../../datasource';
import { render } from '@testing-library/react';
import { Editor } from './Editor';

// we mock the @grafana/ui components we use to make sure they just show their "value".
// we mostly need this for `Input`, because that one is not visible with `.textContent`,
// but i have decided to do all we use to be consistent here.
jest.mock('@grafana/ui', () => {
  const Input = ({ value, placeholder }: { value: string; placeholder?: string }) => (
    <span>[{value || placeholder}]</span>
  );
  const WithContextMenu = ({ children }: { children: (x: unknown) => JSX.Element }) => (
    <span>[{children({ openMenu: undefined })}]</span>
  );
  const Select = ({ value }: { value: string }) => <span>[{value}]</span>;

  const orig = jest.requireActual('@grafana/ui');

  return {
    ...orig,
    Input,
    WithContextMenu,
    Select,
  };
});

jest.mock('./Seg', () => {
  const Seg = ({ value }: { value: string }) => <span>[{value}]</span>;
  return {
    Seg,
  };
});

function assertEditor(query: InfluxQuery, textContent: string) {
  const onChange = jest.fn();
  const onRunQuery = jest.fn();
  const datasource: InfluxDatasource = {} as InfluxDatasource;
  const { container } = render(
    <Editor query={query} datasource={datasource} onChange={onChange} onRunQuery={onRunQuery} />
  );
  expect(container.textContent).toBe(textContent);
}

describe('InfluxDB InfluxQL Visual Editor', () => {
  it('should handle minimal query', () => {
    const query: InfluxQuery = {
      refId: 'A',
    };
    assertEditor(
      query,
      'from[default][select measurement]where[+]' +
        'select[field]([value])[mean]()[+]' +
        'group by[time]([$__interval])[fill]([null])[+]' +
        'timezone[(optional)]order by time[ASC]' +
        'limit[(optional)]slimit[(optional)]' +
        'format as[time_series]alias[Naming pattern]'
    );
  });
  it('should have the alias-field hidden when format-as-table', () => {
    const query: InfluxQuery = {
      refId: 'A',
      alias: 'test-alias',
      resultFormat: 'table',
    };
    assertEditor(
      query,
      'from[default][select measurement]where[+]' +
        'select[field]([value])[mean]()[+]' +
        'group by[time]([$__interval])[fill]([null])[+]' +
        'timezone[(optional)]order by time[ASC]' +
        'limit[(optional)]slimit[(optional)]' +
        'format as[table]'
    );
  });
  it('should handle complex query', () => {
    const query: InfluxQuery = {
      refId: 'A',
      policy: 'default',
      resultFormat: 'logs',
      orderByTime: 'DESC',
      tags: [
        {
          key: 'cpu',
          operator: '=',
          value: 'cpu1',
        },
        {
          condition: 'AND',
          key: 'cpu',
          operator: '<',
          value: 'cpu3',
        },
      ],
      groupBy: [
        {
          type: 'time',
          params: ['$__interval'],
        },
        {
          type: 'tag',
          params: ['cpu'],
        },
        {
          type: 'tag',
          params: ['host'],
        },
        {
          type: 'fill',
          params: ['null'],
        },
      ],
      select: [
        [
          {
            type: 'field',
            params: ['usage_idle'],
          },
          {
            type: 'mean',
            params: [],
          },
        ],
        [
          {
            type: 'field',
            params: ['usage_guest'],
          },
          {
            type: 'median',
            params: [],
          },
          {
            type: 'holt_winters_with_fit',
            params: [10, 2],
          },
        ],
      ],
      measurement: 'cpu',
      limit: '4',
      slimit: '5',
      tz: 'UTC',
      alias: 'all i as',
    };
    assertEditor(
      query,
      'from[default][cpu]where[cpu][=][cpu1][AND][cpu][<][cpu3][+]' +
        'select[field]([usage_idle])[mean]()[+]' +
        '[field]([usage_guest])[median]()[holt_winters_with_fit]([10],[2])[+]' +
        'group by[time]([$__interval])[tag]([cpu])[tag]([host])[fill]([null])[+]' +
        'timezone[UTC]order by time[DESC]' +
        'limit[4]slimit[5]' +
        'format as[logs]alias[all i as]'
    );
  });
});
