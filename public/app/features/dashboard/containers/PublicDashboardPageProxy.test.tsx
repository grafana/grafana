import 'whatwg-fetch';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { config, locationService } from '@grafana/runtime';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { backendSrv } from 'app/core/services/backend_srv';
import { configureStore } from 'app/store/configureStore';

import { DashboardRoutes } from '../../../types';

import PublicDashboardPageProxy, { PublicDashboardPageProxyProps } from './PublicDashboardPageProxy';

const { PublicDashboardScene, PublicDashboard } = e2eSelectors.pages;

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn().mockReturnValue({
    getInstanceSettings: () => {
      return { name: 'Grafana' };
    },
    get: jest.fn().mockResolvedValue({}),
  }),
}));

function setup(props: Partial<PublicDashboardPageProxyProps>) {
  const context = getGrafanaContextMock();
  const store = configureStore({});

  return render(
    <GrafanaContext.Provider value={context}>
      <Provider store={store}>
        <Router history={locationService.getHistory()}>
          <PublicDashboardPageProxy
            location={locationService.getLocation()}
            history={locationService.getHistory()}
            queryParams={{}}
            route={{ routeName: DashboardRoutes.Public, component: () => null, path: '/:accessToken' }}
            match={{ params: { accessToken: 'an-access-token' }, isExact: true, path: '/', url: '/' }}
            {...props}
          />
        </Router>
      </Provider>
    </GrafanaContext.Provider>
  );
}

describe('PublicDashboardPageProxy', () => {
  beforeEach(() => {
    config.featureToggles.publicDashboardsScene = false;

    // Mock the dashboard UID response so we don't get any refused connection errors
    // from this test (as the fetch polyfill means this logic would actually try and call the API)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(backendSrv, 'getPublicDashboardByUid').mockResolvedValue({ dashboard: {}, meta: {} } as any);
  });

  describe('when scene feature enabled', () => {
    it('should render PublicDashboardScenePage if publicDashboardsScene is enabled', async () => {
      config.featureToggles.publicDashboardsScene = true;
      setup({});

      await waitFor(() => {
        expect(screen.queryByTestId(PublicDashboardScene.page)).toBeInTheDocument();
      });
    });
  });

  describe('when scene feature disabled', () => {
    it('should render PublicDashboardPage if publicDashboardsScene is disabled', async () => {
      setup({});

      await waitFor(() => {
        expect(screen.queryByTestId(PublicDashboard.page)).toBeInTheDocument();
      });
    });
  });
});
