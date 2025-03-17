import { cleanup, waitFor } from '@testing-library/react';
import { KBarProvider } from 'kbar';
import { render } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { config, setPluginImportUtils } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { defaultDashboard } from '@grafana/schema';
import { AppChrome } from 'app/core/components/AppChrome/AppChrome';
import { transformSaveModelToScene } from 'app/features/dashboard-scene/serialization/transformSaveModelToScene';
import { DashboardDataDTO, DashboardDTO, DashboardMeta } from 'app/types';

import { defaultScopesServices, ScopesContextProvider } from '../../ScopesContextProvider';

import { getMock } from './mocks';

const getDashboardDTO: (
  overrideDashboard: Partial<DashboardDataDTO>,
  overrideMeta: Partial<DashboardMeta>
) => DashboardDTO = (overrideDashboard, overrideMeta) => ({
  dashboard: {
    ...defaultDashboard,
    title: 'hello',
    uid: 'dash-1',
    description: 'hello description',
    templating: {
      list: [
        {
          datasource: {
            type: 'datasource',
            uid: 'grafana',
          },
          filters: [],
          name: 'Filters',
          type: 'adhoc',
        },
        {
          current: {
            text: [],
            value: [],
          },
          datasource: {
            type: 'datasource',
            uid: 'grafana',
          },
          description: '',
          label: 'Group By',
          name: 'groupBy',
          type: 'groupby',
        },
        {
          current: {
            text: ['1'],
            value: ['1'],
          },
          multi: true,
          name: 'myVar',
          options: [
            {
              selected: true,
              text: '1',
              value: '1',
            },
            {
              selected: false,
              text: '2',
              value: '2',
            },
          ],
          query: '1, 2',
          type: 'custom',
        },
        {
          current: {
            text: ['1'],
            value: ['1'],
          },
          multi: true,
          name: 'myVar2',
          options: [
            {
              selected: true,
              text: '1',
              value: '1',
            },
            {
              selected: false,
              text: '2',
              value: '2',
            },
          ],
          query: '1, 2',
          type: 'custom',
        },
      ],
    },
    panels: [
      {
        datasource: {
          type: 'datasource',
          uid: 'grafana',
        },
        fieldConfig: {
          defaults: {
            color: {
              mode: 'thresholds',
            },
            custom: {
              align: 'auto',
              cellOptions: {
                type: 'auto',
              },
              inspect: false,
            },
            mappings: [],
            thresholds: {
              mode: 'absolute',
              steps: [
                {
                  color: 'green',
                  value: null,
                },
                {
                  color: 'red',
                  value: 80,
                },
              ],
            },
          },
          overrides: [],
        },
        gridPos: {
          h: 8,
          w: 12,
          x: 0,
          y: 0,
        },
        id: 1,
        options: {
          cellHeight: 'sm',
          footer: {
            countRows: false,
            fields: '',
            reducer: ['sum'],
            show: false,
          },
          showHeader: true,
        },
        pluginVersion: '11.3.0-pre',
        targets: [
          {
            refId: 'A',
          },
        ],
        title: 'Panel Title',
        type: 'table',
      },
    ],
    ...overrideDashboard,
  },
  meta: {
    ...overrideMeta,
  },
});

const panelPlugin = getPanelPlugin({
  id: 'table',
  skipDataQuery: true,
});

config.panels['table'] = panelPlugin.meta;

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(panelPlugin),
  getPanelPluginFromCache: () => undefined,
});

export async function renderDashboard(
  overrideDashboard: Partial<DashboardDataDTO> = {},
  overrideMeta: Partial<DashboardMeta> = {}
) {
  jest.useFakeTimers({ advanceTimers: true });
  jest.spyOn(console, 'error').mockImplementation(jest.fn());

  const dto: DashboardDTO = getDashboardDTO(overrideDashboard, overrideMeta);
  const scene = transformSaveModelToScene(dto);

  const services = defaultScopesServices();

  render(
    <KBarProvider>
      <ScopesContextProvider services={services}>
        <AppChrome>
          <scene.Component model={scene} />
        </AppChrome>
      </ScopesContextProvider>
    </KBarProvider>
  );

  await waitFor(() => expect(sceneGraph.getScopesBridge(scene)).toBeDefined());

  return {
    scene,
    ...services,
  };
}

export async function resetScenes(spies: jest.SpyInstance[] = []) {
  await jest.runOnlyPendingTimersAsync();
  jest.useRealTimers();
  getMock.mockClear();
  spies.forEach((spy) => spy.mockClear());
  cleanup();
}
