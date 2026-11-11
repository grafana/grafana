import { act } from '@testing-library/react';
import { render } from 'test/test-utils';

import { config, setPluginLinksHook } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv, RedirectToUrlKey } from 'app/core/services/context_srv';
import { getLoginSectionTitle } from 'app/core/services/loginSectionTitle';

import { DashboardScene } from './DashboardScene';
import { DashboardSceneRenderer } from './DashboardSceneRenderer';

setPluginLinksHook(() => ({ links: [], isLoading: false }));

describe('DashboardSceneRenderer login title', () => {
  const originalSignedIn = contextSrv.user.isSignedIn;
  const originalSubUrl = config.appSubUrl;

  beforeEach(() => {
    contextSrv.user.isSignedIn = true;
    config.appSubUrl = '';
    sessionStorage.clear();
    setTestFlags({
      [FlagKeys.GrafanaPreserveLoginTabTitle]: true,
      [FlagKeys.GrafanaPreserveDashboardLoginTabTitle]: true,
    });
  });

  afterEach(() => {
    contextSrv.user.isSignedIn = originalSignedIn;
    config.appSubUrl = originalSubUrl;
    sessionStorage.clear();
    act(() => setTestFlags({}));
  });

  function setup() {
    const dashboard = new DashboardScene({ uid: 'abc', title: 'Mimir / Writes' });
    const node = { id: 'dashboards/browse', text: 'Dashboards' };
    render(<DashboardSceneRenderer model={dashboard} />, {
      historyOptions: { initialEntries: ['/d/abc/writes'] },
      preloadedState: { navIndex: { 'dashboards/browse': node } },
    });
    sessionStorage.setItem(RedirectToUrlKey, encodeURIComponent('/d/abc/writes'));
    return dashboard;
  }

  it('remembers a renamed title without remounting the dashboard', () => {
    const dashboard = setup();
    expect(getLoginSectionTitle()).toBe('Mimir / Writes');

    act(() => dashboard.setState({ title: 'Mimir / Reads' }));

    expect(getLoginSectionTitle()).toBe('Mimir / Reads');
  });

  it('remembers the dashboard title when the original flag becomes enabled', async () => {
    setTestFlags({
      [FlagKeys.GrafanaPreserveLoginTabTitle]: false,
      [FlagKeys.GrafanaPreserveDashboardLoginTabTitle]: true,
    });
    setup();
    expect(sessionStorage.getItem('grafana.loginSection')).toBeNull();

    await act(async () =>
      setTestFlags({
        [FlagKeys.GrafanaPreserveLoginTabTitle]: true,
        [FlagKeys.GrafanaPreserveDashboardLoginTabTitle]: true,
      })
    );

    expect(getLoginSectionTitle()).toBe('Mimir / Writes');
  });
});
