import { lastValueFrom } from 'rxjs';

import { CoreApp, DataQueryRequest, getDefaultTimeRange } from '@grafana/data';

import { DataAPI, VariableSupport } from './VariableSupport';
import { ProfileTypeMessage, VariableQuery } from './types';

describe('VariableSupport', () => {
  it('should query profiles', async function () {
    const mock = getDataApiMock();
    const vs = new VariableSupport(mock);
    const resp = await lastValueFrom(vs.query(getDefaultRequest()));
    expect(resp.data).toEqual([
      { text: 'profile type 1', value: 'profile:type:1' },
      { text: 'profile type 2', value: 'profile:type:2' },
      { text: 'profile type 3', value: 'profile:type:3' },
    ]);
  });

  it('should query labels', async function () {
    const mock = getDataApiMock();
    const vs = new VariableSupport(mock);
    const resp = await lastValueFrom(
      vs.query(getDefaultRequest({ type: 'label', profileTypeId: 'profile:type:3', refId: 'A' }))
    );
    expect(resp.data).toEqual([{ text: 'foo' }, { text: 'bar' }, { text: 'baz' }]);
    expect(mock.getLabelNames).toBeCalledWith('profile:type:3{}', expect.any(Number), expect.any(Number));
  });

  it('should query label values', async function () {
    const mock = getDataApiMock();
    const vs = new VariableSupport(mock);
    const resp = await lastValueFrom(
      vs.query(getDefaultRequest({ type: 'labelValue', labelName: 'foo', profileTypeId: 'profile:type:3', refId: 'A' }))
    );
    expect(resp.data).toEqual([{ text: 'val1' }, { text: 'val2' }, { text: 'val3' }]);
    expect(mock.getLabelValues).toBeCalledWith('profile:type:3{}', 'foo', expect.any(Number), expect.any(Number));
  });
});

function getDefaultRequest(
  query: VariableQuery = { type: 'profileType', refId: 'A' }
): DataQueryRequest<VariableQuery> {
  return {
    targets: [query],
    interval: '1s',
    intervalMs: 1000,
    range: getDefaultTimeRange(),
    scopedVars: {},
    timezone: 'utc',
    app: CoreApp.Unknown,
    requestId: '1',
    startTime: 0,
  };
}

function getDataApiMock(): DataAPI {
  const profiles: ProfileTypeMessage[] = [
    { id: 'profile:type:1', label: 'profile type 1' },
    { id: 'profile:type:2', label: 'profile type 2' },
    { id: 'profile:type:3', label: 'profile type 3' },
  ];
  const getProfileTypes = jest.fn().mockResolvedValueOnce(profiles);

  const getLabelValues = jest.fn().mockResolvedValueOnce(['val1', 'val2', 'val3']);
  const getLabelNames = jest.fn().mockResolvedValueOnce(['foo', 'bar', 'baz']);

  return {
    getProfileTypes,
    getLabelNames,
    getLabelValues,
  };
}
