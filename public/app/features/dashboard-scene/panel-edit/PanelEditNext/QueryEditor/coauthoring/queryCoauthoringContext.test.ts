import { config, getDataSourceInstance, getDataSourceInstanceSettings } from '@grafana/runtime';
import { SceneTimeRange, VizPanel } from '@grafana/scenes';
import { getMockDataSource } from 'app/features/query/state/mocks/mockDataSource';

import { ds1SettingsMock } from '../testUtils';

import { resolveCoauthoringQuery } from './queryCoauthoringContext';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceInstance: jest.fn(),
  getDataSourceInstanceSettings: jest.fn(),
}));

afterEach(() => jest.restoreAllMocks());

it.each([
  [{ uid: '-- Mixed --' }, undefined, { uid: 'mock-default', type: 'mock' }],
  [{ uid: 'inherited' }, undefined, { uid: 'inherited' }],
  [{ uid: '-- Mixed --' }, { uid: '${local}' }, { uid: '${local}' }],
])('resolves current effective datasource with panel scope (%j, %j)', async (fallback, explicit, expected) => {
  jest.replaceProperty(config, 'defaultDatasource', 'mock-default');
  jest
    .mocked(getDataSourceInstanceSettings)
    .mockImplementation(async (ref) =>
      ref === 'mock-default' ? { ...ds1SettingsMock, uid: 'mock-default', type: 'mock' } : undefined
    );
  jest
    .mocked(getDataSourceInstance)
    .mockResolvedValue(Object.assign(getMockDataSource(), { queryCoauthoring: () => undefined }));
  const panel = new VizPanel({ $timeRange: new SceneTimeRange({}) });
  await resolveCoauthoringQuery(panel, { refId: 'A', datasource: explicit }, fallback, new AbortController().signal);
  expect(getDataSourceInstance).toHaveBeenLastCalledWith(
    expected,
    expect.objectContaining({ __sceneObject: expect.anything() })
  );
  expect(getDataSourceInstanceSettings).toHaveBeenLastCalledWith(
    fallback.uid === '-- Mixed --' && !explicit ? 'mock-default' : expected,
    expect.objectContaining({ __sceneObject: expect.anything() })
  );
});

it('uses Mixed metadata and preserves missing-default behavior without loading a datasource', async () => {
  jest.replaceProperty(config, 'defaultDatasource', 'missing');
  jest.mocked(getDataSourceInstance).mockClear();
  jest
    .mocked(getDataSourceInstanceSettings)
    .mockImplementation(async (ref) =>
      typeof ref === 'object' && ref?.uid === 'mixed-alias'
        ? { ...ds1SettingsMock, meta: { ...ds1SettingsMock.meta, mixed: true } }
        : undefined
    );
  const result = await resolveCoauthoringQuery(
    new VizPanel({ $timeRange: new SceneTimeRange({}) }),
    { refId: 'A' },
    { uid: 'mixed-alias' },
    new AbortController().signal
  );
  expect(result.editability).toEqual({ kind: 'unknown', reason: 'datasource_resolution_failed' });
  expect(getDataSourceInstance).not.toHaveBeenCalled();
});
