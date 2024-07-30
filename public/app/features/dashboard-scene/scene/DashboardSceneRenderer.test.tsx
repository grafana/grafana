import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { Router } from 'react-router';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { configureStore } from 'app/store/configureStore';

import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';

describe('DashboardSceneRenderer', () => {
  it('should render Not Found notice when dashboard is not found', async () => {
    const scene = transformSaveModelToScene({
      meta: {
        isSnapshot: true,
        dashboardNotFound: true,
        canStar: false,
        canDelete: false,
        canSave: false,
        canEdit: false,
        canShare: false,
      },
      dashboard: {
        title: 'Not found',
        uid: 'uid',
        schemaVersion: 0,
        // Disabling build in annotations to avoid mocking Grafana data source
        annotations: {
          list: [
            {
              builtIn: 1,
              datasource: {
                type: 'grafana',
                uid: '-- Grafana --',
              },
              enable: false,
              hide: true,
              iconColor: 'rgba(0, 211, 255, 1)',
              name: 'Annotations & Alerts',
              type: 'dashboard',
            },
          ],
        },
      },
    });

    const store = configureStore({});
    const context = getGrafanaContextMock();

    render(
      <GrafanaContext.Provider value={context}>
        <Provider store={store}>
          <Router history={locationService.getHistory()}>
            <scene.Component model={scene} />
          </Router>
        </Provider>
      </GrafanaContext.Provider>
    );

    expect(await screen.findByTestId(selectors.components.EntityNotFound.container)).toBeInTheDocument();
  });
});
