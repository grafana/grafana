import { screen, waitFor } from '@testing-library/react';
import { useParams } from 'react-router-dom-v5-compat';
import { type Props } from 'react-virtualized-auto-sizer';
import { render } from 'test/test-utils';

import { config, locationService } from '@grafana/runtime';
import { DashboardRoutes } from 'app/types/dashboard';

import DashboardPageProxy, { type DashboardPageProxyProps } from './DashboardPageProxy';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn().mockReturnValue({
    getInstanceSettings: () => {
      return { name: 'Grafana' };
    },
    get: jest.fn().mockResolvedValue({}),
  }),
  useChromeHeaderHeight: jest.fn(),
  getBackendSrv: () => {
    return {
      get: jest.fn().mockResolvedValue({ dashboard: {}, meta: { url: '' } }),
    };
  },
}));

jest.mock('react-virtualized-auto-sizer', () => {
  return ({ children }: Props) =>
    children({
      height: 1,
      scaledHeight: 1,
      scaledWidth: 1,
      width: 1,
    });
});

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useParams: jest.fn().mockReturnValue({}),
}));

function setup(props: Partial<DashboardPageProxyProps> & { uid?: string }) {
  (useParams as jest.Mock).mockReturnValue({ uid: props.uid });
  return render(
    <DashboardPageProxy
      location={locationService.getLocation()}
      queryParams={{}}
      route={{ routeName: DashboardRoutes.Home, component: () => null, path: '/' }}
      {...props}
    />
  );
}

describe('DashboardPageProxy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.featureToggles.kubernetesDashboards = false;
  });

  it('should render DashboardScenePage for home route', async () => {
    setup({
      route: { routeName: DashboardRoutes.Home, component: () => null, path: '/' },
    });

    await waitFor(() => {
      expect(screen.queryAllByTestId('dashboard-scene-page')).toHaveLength(1);
    });
  });

  it('should render DashboardScenePage for normal route with uid', async () => {
    setup({
      route: { routeName: DashboardRoutes.Normal, component: () => null, path: '/' },
      uid: 'abc-def',
    });

    await waitFor(() => {
      expect(screen.queryAllByTestId('dashboard-scene-page')).toHaveLength(1);
    });
  });
});
