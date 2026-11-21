import { type GrafanaConfig, locationUtil, type NavIndex, type NavModelItem } from '@grafana/data';
import { getState } from 'app/store/store';

import { getAppPluginRoutes } from './routes';

jest.mock('app/store/store', () => ({
  getState: jest.fn(),
}));

const home: NavModelItem = { id: 'home', text: 'Home', url: '/' };

function setup(appSubUrl: string) {
  locationUtil.initialize({
    config: { appSubUrl } as GrafanaConfig,
    getVariablesUrlParams: jest.fn(),
    getTimeRangeForUrl: jest.fn(),
  });

  const navIndex: NavIndex = {
    home,
    // Standalone pages carry a core URL, which the nav tree has already prefixed
    // with the app sub url
    'standalone-plugin-page-/a/grafana-auth-app': {
      id: 'standalone-plugin-page-/a/grafana-auth-app',
      text: 'Access policies',
      url: `${appSubUrl}/a/grafana-auth-app`,
      pluginId: 'grafana-auth-app',
      parentItem: home,
    },
  };
  jest.mocked(getState).mockReturnValue({ navIndex } as ReturnType<typeof getState>);
}

describe('getAppPluginRoutes', () => {
  // The history basename strips the sub url before the router matches, so a
  // route path carrying it could never match
  it('registers a standalone page route without the app sub url', () => {
    setup('/grafana');

    expect(getAppPluginRoutes().map((route) => route.path)).toContain('/a/grafana-auth-app/*');
  });

  it('leaves the path alone when there is no app sub url', () => {
    setup('');

    expect(getAppPluginRoutes().map((route) => route.path)).toContain('/a/grafana-auth-app/*');
  });
});
