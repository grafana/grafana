import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { config, setPluginImportUtils } from '@grafana/runtime';

import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useChromeHeaderHeight: jest.fn(),
  getDataSourceSrv: () => {
    return {
      getInstanceSettings: jest.fn().mockResolvedValue({ uid: 'ds1' }),
    };
  },
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    angularSupportEnabled: true,
    panels: {
      'briangann-datatable-panel': {
        id: 'briangann-datatable-panel',
        state: 'deprecated',
        angular: { detected: true, hideDeprecation: false },
      },
    },
  },
}));

describe('DashboardSceneRenderer', () => {
  it('should render angular deprecation notice when dashboard contains angular components', async () => {
    const noticeText = /This dashboard depends on Angular/i;
    //enable feature flag angularDeprecationUI
    config.featureToggles.angularDeprecationUI = true;
    const scene = transformSaveModelToScene({
      meta: {},
      dashboard: {
        title: 'Angular dashboard',
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

        panels: [
          {
            id: 1,
            type: 'briangann-datatable-panel',
            gridPos: { x: 0, y: 0, w: 12, h: 6 },
            title: 'Angular component',
            options: {
              showHeader: true,
            },
            fieldConfig: { defaults: {}, overrides: [] },
            datasource: { uid: 'abcdef' },
            targets: [{ refId: 'A' }],
          },
        ],
      },
    });

    render(<scene.Component model={scene} />);

    expect(await screen.findByText(noticeText)).toBeInTheDocument();
  });
});
