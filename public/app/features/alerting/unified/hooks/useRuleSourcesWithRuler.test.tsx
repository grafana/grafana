import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import React from 'react';
import { Provider } from 'react-redux';

import type { DataSourceJsonData } from '@grafana/data/types';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types/accessControl';
import { PromApplication } from 'app/types/unified-alerting-dto';

import * as buildInfoModule from '../api/buildInfo';
import { setupMswServer } from '../mockApi';
import { grantUserPermissions, mockDataSource } from '../mocks';
import { setupDataSources } from '../testSetup/datasources';
import { buildInfoResponse } from '../testSetup/featureDiscovery';

import { useRulesSourcesWithRuler } from './useRuleSourcesWithRuler';

const server = setupMswServer();

function getProviderWrapper() {
  const store = configureStore();
  return ({ children }: React.PropsWithChildren<{}>) => <Provider store={store}>{children}</Provider>;
}

// Creates a Prometheus datasource with manageAlerts:true so getRulesDataSources() includes it
function makeMimirDatasource(uid: string, name: string) {
  return mockDataSource({
    uid,
    name,
    type: 'prometheus',
    jsonData: { manageAlerts: true } as DataSourceJsonData,
  });
}

beforeEach(() => {
  grantUserPermissions([AccessControlAction.AlertingRuleExternalRead, AccessControlAction.AlertingRuleExternalWrite]);
});

describe('useRulesSourcesWithRuler — baseline (current behaviour)', () => {
  it('starts with empty list and no loading when there are no datasources', () => {
    setupDataSources();

    const { result } = renderHook(() => useRulesSourcesWithRuler(), {
      wrapper: getProviderWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.rulesSourcesWithRuler).toEqual([]);
  });

  it('returns datasources whose buildinfo indicates ruler support (Mimir)', async () => {
    setupDataSources(makeMimirDatasource('mimir-1', 'Mimir 1'));

    server.use(
      http.get('/api/datasources/proxy/uid/:uid/api/v1/status/buildinfo', () =>
        HttpResponse.json(buildInfoResponse.mimir)
      )
    );

    const { result } = renderHook(() => useRulesSourcesWithRuler(), {
      wrapper: getProviderWrapper(),
    });

    await waitFor(() => expect(result.current.rulesSourcesWithRuler).toHaveLength(1));
    expect(result.current.rulesSourcesWithRuler[0].uid).toBe('mimir-1');
  });

  it('excludes datasources whose buildinfo indicates no ruler support (vanilla Prometheus)', async () => {
    setupDataSources(makeMimirDatasource('prom-1', 'Prometheus 1'));

    server.use(
      http.get('/api/datasources/proxy/uid/:uid/api/v1/status/buildinfo', () =>
        HttpResponse.json(buildInfoResponse.prometheus)
      )
    );

    const { result } = renderHook(() => useRulesSourcesWithRuler(), {
      wrapper: getProviderWrapper(),
    });

    // Wait for discovery to settle — list should remain empty
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rulesSourcesWithRuler).toHaveLength(0);
  });

  it('handles a mix of ruler and non-ruler datasources', async () => {
    setupDataSources(makeMimirDatasource('mimir-1', 'Mimir 1'), makeMimirDatasource('prom-1', 'Prometheus 1'));

    server.use(
      http.get('/api/datasources/proxy/uid/:uid/api/v1/status/buildinfo', ({ params }) =>
        params.uid === 'mimir-1'
          ? HttpResponse.json(buildInfoResponse.mimir)
          : HttpResponse.json(buildInfoResponse.prometheus)
      )
    );

    const { result } = renderHook(() => useRulesSourcesWithRuler(), {
      wrapper: getProviderWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rulesSourcesWithRuler).toHaveLength(1);
    expect(result.current.rulesSourcesWithRuler[0].uid).toBe('mimir-1');
  });
});

// These tests document bugs in the current implementation.
// They are EXPECTED TO FAIL against the unmodified hook and PASS after the fix.
describe('useRulesSourcesWithRuler — bug reproductions (must fail before fix)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('BUG: fires all requests simultaneously instead of in batches of 10', async () => {
    // getRulesDataSources() sorts by name, so all datasources are processed in
    // alphabetical order. We spy on discoverFeaturesByUid (called inside the RTK
    // Query queryFn) to measure true in-process concurrency, which is not subject
    // to test-environment serialization at the network/MSW layer.
    const dataSources = Array.from({ length: 25 }, (_, i) =>
      makeMimirDatasource(`ds-${String(i).padStart(2, '0')}`, `DS ${String(i).padStart(2, '0')}`)
    );
    setupDataSources(...dataSources);

    let concurrentCount = 0;
    let peakConcurrentCount = 0;

    jest.spyOn(buildInfoModule, 'discoverFeaturesByUid').mockImplementation(async () => {
      concurrentCount++;
      peakConcurrentCount = Math.max(peakConcurrentCount, concurrentCount);
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
      concurrentCount--;
      return { application: PromApplication.Mimir, features: { rulerApiEnabled: true } };
    });

    const { result } = renderHook(() => useRulesSourcesWithRuler(), {
      wrapper: getProviderWrapper(),
    });

    await waitFor(() => expect(result.current.rulesSourcesWithRuler).toHaveLength(25), { timeout: 5000 });

    // FAILS on the current code: all 25 fire at once (peakConcurrentCount === 25)
    // PASSES after the fix: batches of 10 (peakConcurrentCount <= 10)
    expect(peakConcurrentCount).toBeLessThanOrEqual(10);
  });

  it('BUG: isLoading goes false before all datasources have resolved', async () => {
    // getRulesDataSources() sorts by name alphabetically. We give the slow datasource
    // a name that sorts BEFORE the fast one ("AA..." < "ZZ..."), so the forEach loop
    // triggers slow-ds first and fast-ds LAST. The broken isLoading only reflects the
    // last-triggered lazy query (fast-ds). Since fast-ds has no delay, isLoading goes
    // false while slow-ds is still pending, leaving only 1 result instead of 2.
    const slow = makeMimirDatasource('slow-ds', 'AA Slow DS');
    const fast = makeMimirDatasource('fast-ds', 'ZZ Fast DS');
    setupDataSources(slow, fast);

    server.use(
      http.get('/api/datasources/proxy/uid/:uid/api/v1/status/buildinfo', async ({ params }) => {
        if (params.uid === 'slow-ds') {
          await delay(200);
        }
        return HttpResponse.json(buildInfoResponse.mimir);
      })
    );

    const { result } = renderHook(() => useRulesSourcesWithRuler(), {
      wrapper: getProviderWrapper(),
    });

    // Wait until isLoading goes false
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // FAILS on the current code: isLoading goes false as soon as the last-triggered
    // query (fast-ds / "ZZ Fast DS") resolves, but slow-ds has not resolved yet —
    // only 1 result present.
    // PASSES after the fix: isLoading stays true until ALL datasources have resolved.
    expect(result.current.rulesSourcesWithRuler).toHaveLength(2);
  });
});
