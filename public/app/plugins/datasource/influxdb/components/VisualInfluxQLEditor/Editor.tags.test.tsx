import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import InfluxDatasource from '../../datasource';
import * as mockedMeta from '../../influxQLMetadataQuery';
import { InfluxQuery } from '../../types';

import { Editor } from './Editor';

jest.mock('../../influxQLMetadataQuery', () => {
  return {
    getTagKeysForMeasurementAndTags: jest
      .fn()
      // first time we are called when the widget mounts,
      // we respond by saying `cpu, host` are the real tags
      .mockReturnValueOnce(Promise.resolve(['cpu', 'host']))
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
    getAllMeasurementsForTags: jest
      .fn()
      // it does not matter what we return, as long as it is
      // promise-of-a-list-of-strings
      .mockReturnValueOnce(Promise.resolve([])),
  };
});

beforeEach(() => {
  (mockedMeta.getTagKeysForMeasurementAndTags as jest.Mock).mockClear();
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
];

const query: InfluxQuery = {
  refId: 'A',
  policy: 'default',
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
      key: 'field1',
      operator: '=',
      value: '45',
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
    render(<Editor query={query} datasource={datasource} onChange={onChange} onRunQuery={onRunQuery} />);

    // when the editor-widget mounts, it calls getTagKeysForMeasurementAndTags
    expect(mockedMeta.getTagKeysForMeasurementAndTags).toHaveBeenCalledTimes(1);

    // we click the WHERE/cpu button
    await userEvent.click(screen.getByRole('button', { name: 'cpu' }));

    // and verify getTagKeysForMeasurementAndTags was called again,
    // and in the tags-param we did not receive the `field1` part.
    expect(mockedMeta.getTagKeysForMeasurementAndTags).toHaveBeenCalledTimes(2);
    expect((mockedMeta.getTagKeysForMeasurementAndTags as jest.Mock).mock.calls[1][2]).toStrictEqual(ONLY_TAGS);

    // now we click on the WHERE/host2 button
    await userEvent.click(screen.getByRole('button', { name: 'host2' }));

    // verify `getTagValues` was called once, and in the tags-param we did not receive `field1`
    expect(mockedMeta.getTagValues).toHaveBeenCalledTimes(1);
    expect((mockedMeta.getTagValues as jest.Mock).mock.calls[0][3]).toStrictEqual(ONLY_TAGS);

    // now we click on the FROM/cpudata button
    await userEvent.click(screen.getByRole('button', { name: 'cpudata' }));

    // verify `getTagValues` was called once, and in the tags-param we did not receive `field1`
    expect(mockedMeta.getAllMeasurementsForTags).toHaveBeenCalledTimes(1);
    expect((mockedMeta.getAllMeasurementsForTags as jest.Mock).mock.calls[0][1]).toStrictEqual(ONLY_TAGS);
  });
});
