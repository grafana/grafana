import { screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom-v5-compat';
import { of } from 'rxjs';
import { render } from 'test/test-utils';

import { getDefaultTimeRange, LoadingState, type PanelData } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { locationService, setRunRequest } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { type DashboardDTO, DashboardRoutes } from 'app/types/dashboard';

import PublicDashboardPageProxy, { type PublicDashboardPageProxyProps } from './PublicDashboardPageProxy';

const { PublicDashboardScene } = e2eSelectors.pages;

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn().mockReturnValue({
    getInstanceSettings: () => {
      return { name: 'Grafana' };
    },
    get: jest.fn().mockResolvedValue({}),
  }),
}));

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useParams: () => ({ accessToken: 'an-access-token' }),
}));

const runRequestMock = jest.fn().mockReturnValue(
  of<PanelData>({
    state: LoadingState.Done,
    series: [],
    timeRange: getDefaultTimeRange(),
    annotations: [],
  })
);
setRunRequest(runRequestMock);

function setup(props: Partial<PublicDashboardPageProxyProps>) {
  return render(
    <Routes>
      <Route
        path="/public-dashboards/:accessToken"
        element={
          <PublicDashboardPageProxy
            queryParams={{}}
            location={locationService.getLocation()}
            route={{ routeName: DashboardRoutes.Public, component: () => null, path: '/:accessToken' }}
            {...props}
          />
        }
      />
    </Routes>,
    {
      historyOptions: { initialEntries: [`/public-dashboards/an-access-token`] },
    }
  );
}

describe('PublicDashboardPageProxy', () => {
  beforeEach(() => {
    // Mock console methods to avoid jest-fail-on-console issues
    jest.spyOn(console, 'warn').mockImplementation();

    // Mock the dashboard UID response so we don't get any refused connection errors
    // from this test (as the fetch polyfill means this logic would actually try and call the API)
    jest.spyOn(backendSrv, 'getPublicDashboardByUid').mockResolvedValue({ dashboard: {}, meta: {} } as DashboardDTO);
  });

  it('should render PublicDashboardScenePage', async () => {
    setup({});

    await waitFor(() => {
      expect(screen.queryByTestId(PublicDashboardScene.page)).toBeInTheDocument();
    });
  });
});
