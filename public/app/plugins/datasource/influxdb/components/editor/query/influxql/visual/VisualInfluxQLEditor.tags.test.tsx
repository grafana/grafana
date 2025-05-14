import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import InfluxDatasource from '../../../../../datasource';
import * as mockedMeta from '../../../../../influxql_metadata_query';
import { DEFAULT_POLICY, InfluxQuery } from '../../../../../types';

import { VisualInfluxQLEditor } from './VisualInfluxQLEditor';

jest.mock('../../../../../influxql_metadata_query', () => {
  return {
    __esModule: true,
    getAllPolicies: jest.fn().mockReturnValueOnce(Promise.resolve(['default', 'autogen'])),
    getFieldKeys: jest
      .fn()
      .mockReturnValueOnce(Promise.resolve(['free', 'total']))
      .mockReturnValueOnce(Promise.resolve([])),
    getTagKeys: jest
      .fn()
      // first time we are called when the widget mounts,
      // we respond by saying `cpu, host, device` are the real tags
      .mockReturnValueOnce(Promise.resolve(['cpu', 'host', 'device']))
      // afterwards we will be called once when we click
      // on a tag-key in the WHERE section.
      // it does not matter what we return, as long as it is
      // promise-of-a-list-of-strings
      .mockReturnValueOnce(Promise.resolve([])),
    getTagValues: jest
      .fn()
      // it does not matter what we return, as long as it is
      // promise-of-a-list-of-strings
      .mockReturnValueOnce(Promise.resolve([])),
    getAllMeasurements: jest
      .fn()
      // it does not matter what we return, as long as it is
      // promise-of-a-list-of-strings
      .mockReturnValueOnce(Promise.resolve([])),
  };
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: jest.fn().mockReturnValueOnce({
    getVariables: jest.fn().mockReturnValueOnce([]),
  }),
}));

beforeEach(() => {
  (mockedMeta.getTagKeys as jest.Mock).mockClear();
  (mockedMeta.getFieldKeys as jest.Mock).mockClear();
});

const ONLY_TAGS = [
  {
    key: 'cpu',
    operator: '=',
    value: 'cpu1',
  },
  {
    condition: 'AND',
    key: 'host',
    operator: '=',
    value: 'host2',
  },
  {
    condition: 'AND',
    key: 'device::tag',
    operator: '=',
    value: 'sdd',
  },
];

const query: InfluxQuery = {
  refId: 'A',
  policy: DEFAULT_POLICY,
  tags: [
    {
      key: 'cpu',
      operator: '=',
      value: 'cpu1',
    },
    {
      condition: 'AND',
      key: 'host',
      operator: '=',
      value: 'host2',
    },
    {
      condition: 'AND',
      key: 'device::tag',
      operator: '=',
      value: 'sdd',
    },
    {
      condition: 'AND',
      key: 'free',
      operator: '=',
      value: '45',
    },
    {
      condition: 'AND',
      key: 'total::field',
      operator: '=',
      value: '200',
    },
  ],
  select: [
    [
      {
        type: 'field',
        params: ['usage_idle'],
      },
    ],
  ],
  measurement: 'cpudata',
};

describe('InfluxDB InfluxQL Visual Editor field-filtering', () => {
  it('should not send fields in tag-structures to metadata queries', async () => {
    const onChange = jest.fn();
    const onRunQuery = jest.fn();
    const datasource: InfluxDatasource = {
      metricFindQuery: () => Promise.resolve([]),
    } as unknown as InfluxDatasource;
    render(<VisualInfluxQLEditor query={query} datasource={datasource} onChange={onChange} onRunQuery={onRunQuery} />);

    await waitFor(() => {});

    // when the editor-widget mounts, it calls getFieldKeys
    expect(mockedMeta.getFieldKeys).toHaveBeenCalledTimes(1);

    // when the editor-widget mounts, it calls getTagKeys
    expect(mockedMeta.getTagKeys).toHaveBeenCalledTimes(1);

    // now we click on the WHERE/host2 button
    await userEvent.click(screen.getByRole('button', { name: 'host2' }));

    // verify `getTagValues` was called once, and in the tags-param we did not receive `field1`
    expect(mockedMeta.getTagValues).toHaveBeenCalledTimes(1);
    expect((mockedMeta.getTagValues as jest.Mock).mock.calls[0][1]).toStrictEqual(ONLY_TAGS);

    // now we click on the FROM/cpudata button
    await userEvent.click(screen.getByRole('button', { name: 'cpudata' }));

    // verify `getTagValues` was called once, and in the tags-param we did not receive `field1`
    expect(mockedMeta.getAllMeasurements).toHaveBeenCalledTimes(1);
    expect((mockedMeta.getAllMeasurements as jest.Mock).mock.calls[0][1]).toStrictEqual(ONLY_TAGS);
  });
});
