import { renderHook, waitFor } from '@testing-library/react';

import {
  getDataSourcesWithValidRecordingTarget,
  useDataSourcesWithValidRecordingTarget,
  useDataSourcesWithValidRecordingTargetByUid,
} from '@grafana/alerting/unstable';

import { DataSourceInstanceSettingsFactory, setupDataSources } from './grafana/dataSources/mocks/fakes/DataSources';

// Exercises the published entry point, not the implementation module, so a dropped or renamed
// export in unstable.ts fails here.
describe('@grafana/alerting/unstable recording rule target API', () => {
  beforeEach(() => {
    setupDataSources(
      DataSourceInstanceSettingsFactory.build({ uid: 'prom', name: 'prom' }),
      DataSourceInstanceSettingsFactory.build({
        uid: 'opted-out',
        name: 'opted-out',
        jsonData: { allowAsRecordingRulesTarget: false },
      })
    );
  });

  it('getDataSourcesWithValidRecordingTarget resolves to the valid targets', async () => {
    const targets = await getDataSourcesWithValidRecordingTarget();

    expect(targets.map((ds) => ds.uid)).toEqual(['prom']);
  });

  it('useDataSourcesWithValidRecordingTarget returns the valid targets once loaded', async () => {
    const { result } = renderHook(() => useDataSourcesWithValidRecordingTarget());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.map((ds) => ds.uid)).toEqual(['prom']);
  });

  it('useDataSourcesWithValidRecordingTargetByUid keys the valid targets by uid once loaded', async () => {
    const { result } = renderHook(() => useDataSourcesWithValidRecordingTargetByUid());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect([...result.current.byUid.keys()]).toEqual(['prom']);
  });
});
