import { renderHook } from 'test/test-utils';

import { OrgRole, PluginIncludeType, type PluginMeta } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';
import { useIrmPlugin } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { useNotebookIncidents } from './useNotebookIncidents';

// The probe itself is covered by usePluginBridge's own tests; what matters here is what the toolbar
// concludes from it, so canAccessPluginPage below is the real one.
jest.mock('app/features/alerting/unified/hooks/usePluginBridge', () => ({
  ...jest.requireActual('app/features/alerting/unified/hooks/usePluginBridge'),
  useIrmPlugin: jest.fn(),
}));

const mockUseIrmPlugin = jest.mocked(useIrmPlugin);

/** Plugin settings whose declare page is gated on `role`, the way IRM's own includes are. */
function settingsRequiringRole(role: OrgRole): PluginMeta<{}> {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only includes is read
  return {
    id: SupportedPlugin.Irm,
    enabled: true,
    includes: [{ type: PluginIncludeType.page, name: 'Declare', path: '/a/grafana-irm-app/incidents/declare', role }],
  } as unknown as PluginMeta<{}>;
}

function setProbe(result: Partial<ReturnType<typeof useIrmPlugin>>) {
  mockUseIrmPlugin.mockReturnValue({
    pluginId: SupportedPlugin.Irm,
    loading: false,
    ...result,
  });
}

describe('useNotebookIncidents', () => {
  // contextSrv is a singleton the whole suite shares, and canAccessPluginPage reads these
  // directly — so they are assigned and put back rather than spied on.
  const previousRole = contextSrv.user.orgRole;
  const previousIsEditor = contextSrv.isEditor;
  const previousIsGrafanaAdmin = contextSrv.isGrafanaAdmin;

  afterEach(() => {
    contextSrv.user.orgRole = previousRole;
    contextSrv.isEditor = previousIsEditor;
    contextSrv.isGrafanaAdmin = previousIsGrafanaAdmin;
    jest.restoreAllMocks();
  });

  it('is unavailable while the probe is still in flight', () => {
    setProbe({ loading: true });

    expect(renderHook(() => useNotebookIncidents()).result.current.available).toBe(false);
  });

  it('is unavailable when neither IRM nor Incident is installed', () => {
    setProbe({ installed: false });

    expect(renderHook(() => useNotebookIncidents()).result.current.available).toBe(false);
  });

  // Installed but not this user's to open: the actions would only lead to a 403.
  it('is unavailable when the user cannot open the declare page', () => {
    contextSrv.isGrafanaAdmin = false;
    contextSrv.isEditor = false;
    contextSrv.user.orgRole = OrgRole.Viewer;
    jest.spyOn(contextSrv, 'hasRole').mockReturnValue(false);
    setProbe({ installed: true, settings: settingsRequiringRole(OrgRole.Admin) });

    expect(renderHook(() => useNotebookIncidents()).result.current.available).toBe(false);
  });

  it('is available once installed and reachable, and reports which plugin answered', () => {
    contextSrv.isGrafanaAdmin = false;
    contextSrv.user.orgRole = OrgRole.Viewer;
    jest.spyOn(contextSrv, 'hasRole').mockReturnValue(true);
    setProbe({ installed: true, settings: settingsRequiringRole(OrgRole.Viewer) });

    const { result } = renderHook(() => useNotebookIncidents());

    expect(result.current.available).toBe(true);
    expect(result.current.pluginId).toBe(SupportedPlugin.Irm);
  });
});
