import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';

import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useChromeHeaderHeight: jest.fn(),
}));

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

    render(<scene.Component model={scene} />);

    expect(await screen.findByTestId(selectors.components.EntityNotFound.container)).toBeInTheDocument();
  });
});
