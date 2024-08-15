import { screen } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';
import { setChromeHeaderHeightHook } from '@grafana/runtime';
import { useChromeHeaderHeight } from 'app/core/context/GrafanaContext';

import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { render } from 'test/test-utils';

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

    setChromeHeaderHeightHook(useChromeHeaderHeight);

    render(<scene.Component model={scene} />);

    expect(await screen.findByTestId(selectors.components.EntityNotFound.container)).toBeInTheDocument();
  });
});
