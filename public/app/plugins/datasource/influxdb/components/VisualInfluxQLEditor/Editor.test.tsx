import { render, waitFor } from '@testing-library/react';
import React from 'react';

import InfluxDatasource from '../../datasource';
import { InfluxQuery } from '../../types';

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

async function assertEditor(query: InfluxQuery, textContent: string) {
  const onChange = jest.fn();
  const onRunQuery = jest.fn();
  const datasource: InfluxDatasource = {
    metricFindQuery: () => Promise.resolve([]),
  } as unknown as InfluxDatasource;
  const { container } = render(
    <Editor query={query} datasource={datasource} onChange={onChange} onRunQuery={onRunQuery} />
  );
  await waitFor(() => {
    expect(container.textContent).toBe(textContent);
  });
}

describe('InfluxDB InfluxQL Visual Editor', () => {
  it('should handle minimal query', async () => {
    const query: InfluxQuery = {
      refId: 'A',
      policy: 'default',
    };
    await assertEditor(
      query,
      'FROM[default][select measurement]WHERE[+]' +
        'SELECT[field]([value])[mean]()[+]' +
        'GROUP BY[time]([$__interval])[fill]([null])[+]' +
        'TIMEZONE[(optional)]ORDER BY TIME[ASC]' +
        'LIMIT[(optional)]SLIMIT[(optional)]' +
        'FORMAT AS[time_series]ALIAS[Naming pattern]'
    );
  });
  it('should have the alias-field hidden when format-as-table', async () => {
    const query: InfluxQuery = {
      refId: 'A',
      alias: 'test-alias',
      resultFormat: 'table',
      policy: 'default',
    };
    await assertEditor(
      query,
      'FROM[default][select measurement]WHERE[+]' +
        'SELECT[field]([value])[mean]()[+]' +
        'GROUP BY[time]([$__interval])[fill]([null])[+]' +
        'TIMEZONE[(optional)]ORDER BY TIME[ASC]' +
        'LIMIT[(optional)]SLIMIT[(optional)]' +
        'FORMAT AS[table]'
    );
  });
  it('should handle complex query', async () => {
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
    await assertEditor(
      query,
      'FROM[default][cpu]WHERE[cpu][=][cpu1][AND][cpu][<][cpu3][+]' +
        'SELECT[field]([usage_idle])[mean]()[+]' +
        '[field]([usage_guest])[median]()[holt_winters_with_fit]([10],[2])[+]' +
        'GROUP BY[time]([$__interval])[tag]([cpu])[tag]([host])[fill]([null])[+]' +
        'TIMEZONE[UTC]ORDER BY TIME[DESC]' +
        'LIMIT[4]SLIMIT[5]' +
        'FORMAT AS[logs]ALIAS[all i as]'
    );
  });
});
