import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { act, getWrapper } from 'test/test-utils';

import { OrgRole } from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { type AlertManagerCortexConfig, type RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { setupMswServer } from '../../mockApi';
import { grantUserRole } from '../../mocks';
import { KnownProvenance } from '../../types/knownProvenance';

import { useManageImportMenuItem } from './useManageImportMenuItem';

const server = setupMswServer();

const AM_CONFIG_URL = '/api/alertmanager/:name/config/api/v1/alerts';

const importedTree: RouteWithID = { id: '0', name: 'mimir-prod', routes: [] };

/** Serves a Grafana Alertmanager config whose staged import has the given identifier, and counts requests. */
function serveStagedImport(identifier?: string) {
  const requests = { count: 0 };
  server.use(
    http.get(AM_CONFIG_URL, () => {
      requests.count++;
      return HttpResponse.json<AlertManagerCortexConfig>({
        alertmanager_config: {},
        template_files: {},
        extra_config: identifier ? [{ identifier }] : undefined,
      });
    })
  );
  return requests;
}

function renderMenuItem(route: RouteWithID, provenance: string | undefined, isDefaultPolicy = true) {
  return renderHook(() => useManageImportMenuItem(route, provenance, isDefaultPolicy), {
    wrapper: getWrapper({ renderWithRouter: false }),
  });
}

describe('useManageImportMenuItem', () => {
  beforeEach(() => {
    grantUserRole(OrgRole.Admin);
    setTestFlags({ [FlagKeys.AlertingMigrationWizardUI]: true, [FlagKeys.AlertingImportAlertmanagerAPI]: true });
  });
  // The reset fires OpenFeature events while components are still mounted, so it needs act.
  afterEach(async () => {
    await act(async () => {
      setTestFlags();
    });
  });

  it('offers the link on the tree of the staged import', async () => {
    serveStagedImport('mimir-prod');

    const { result } = renderMenuItem(importedTree, KnownProvenance.ConvertedPrometheus);

    await waitFor(() => expect(result.current?.key).toBe('manage-import'));
  });

  it('leaves out an imported tree that is no longer the staged import', async () => {
    const requests = serveStagedImport('other-import');

    const { result } = renderMenuItem(importedTree, KnownProvenance.ConvertedPrometheus);

    await waitFor(() => expect(requests.count).toBeGreaterThan(0));
    expect(result.current).toBeNull();
  });

  it.each([
    ['a tree that was not imported', importedTree, KnownProvenance.None, true],
    ['a nested route', importedTree, KnownProvenance.ConvertedPrometheus, false],
  ])('skips the lookup for %s', async (_, route, provenance, isDefaultPolicy) => {
    const requests = serveStagedImport('mimir-prod');

    const { result } = renderMenuItem(route, provenance, isDefaultPolicy);

    expect(result.current).toBeNull();
    expect(requests.count).toBe(0);
  });

  it('is admin-only, like the Import settings tab', () => {
    grantUserRole(OrgRole.Editor);
    const requests = serveStagedImport('mimir-prod');

    const { result } = renderMenuItem(importedTree, KnownProvenance.ConvertedPrometheus);

    expect(result.current).toBeNull();
    expect(requests.count).toBe(0);
  });

  it('is left out when the Import settings tab is unavailable', () => {
    setTestFlags({ [FlagKeys.AlertingMigrationWizardUI]: true });
    const requests = serveStagedImport('mimir-prod');

    const { result } = renderMenuItem(importedTree, KnownProvenance.ConvertedPrometheus);

    expect(result.current).toBeNull();
    expect(requests.count).toBe(0);
  });
});
