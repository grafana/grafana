import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { config, locationService } from '@grafana/runtime';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { configureStore } from 'app/store/configureStore';

import { DashboardRoutes } from '../../../types';

import PublicDashboardPageProxy, { PublicDashboardPageProxyProps } from './PublicDashboardPageProxy';

const { PublicDashboardScene, PublicDashboard } = e2eSelectors.pages;

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
    config.featureToggles.dashboardSceneForViewers = false;
  });

  describe('when scene feature enabled', () => {
    it('should render PublicDashboardScenePage if dashboardScene is enabled', async () => {
      config.featureToggles.dashboardSceneForViewers = true;
      setup({});

      await waitFor(() => {
        expect(screen.queryByTestId(PublicDashboardScene.page)).toBeInTheDocument();
      });
    });
    it('should render PublicDashboardScenePage if scene query param is set', async () => {
      setup({ queryParams: { scenes: true } });

      await waitFor(() => {
        expect(screen.queryByTestId(PublicDashboardScene.page)).toBeInTheDocument();
      });
    });
  });

  describe('when scene feature disabled', () => {
    it('should render PublicDashboardPage if dashboardScene is disabled', async () => {
      setup({});

      await waitFor(() => {
        expect(screen.queryByTestId(PublicDashboard.page)).toBeInTheDocument();
      });
    });
    it('should render PublicDashboardPage if scene query param is not set', async () => {
      setup({});

      await waitFor(() => {
        expect(screen.queryByTestId(PublicDashboard.page)).toBeInTheDocument();
      });
    });
  });
});
