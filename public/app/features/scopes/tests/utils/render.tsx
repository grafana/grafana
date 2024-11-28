import { cleanup } from '@testing-library/react';
import { KBarProvider } from 'kbar';
import { render } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import {
  config,
  getScopesDashboardsService,
  getScopesSelectorService,
  initializeScopes,
  ScopesDashboardsContext,
  ScopesSelectorContext,
  setBackendSrv,
  setPluginImportUtils,
} from '@grafana/runtime';
import { defaultDashboard } from '@grafana/schema';
import { AppChrome } from 'app/core/components/AppChrome/AppChrome';
import { transformSaveModelToScene } from 'app/features/dashboard-scene/serialization/transformSaveModelToScene';
import { DashboardDataDTO, DashboardDTO, DashboardMeta } from 'app/types';

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

export function renderDashboard(
  overrideDashboard: Partial<DashboardDataDTO> = {},
  overrideMeta: Partial<DashboardMeta> = {}
) {
  jest.useFakeTimers({ advanceTimers: true });
  jest.spyOn(console, 'error').mockImplementation(jest.fn());
  setBackendSrv({
    get: getMock,
    delete: jest.fn(),
    fetch: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    datasourceRequest: jest.fn(),
    request: jest.fn(),
  });
  initializeScopes();

  const dto: DashboardDTO = getDashboardDTO(overrideDashboard, overrideMeta);
  const scene = transformSaveModelToScene(dto);

  render(
    <ScopesSelectorContext.Provider value={getScopesSelectorService()}>
      <ScopesDashboardsContext.Provider value={getScopesDashboardsService()}>
        <KBarProvider>
          <AppChrome>
            <scene.Component model={scene} />
          </AppChrome>
        </KBarProvider>
      </ScopesDashboardsContext.Provider>
    </ScopesSelectorContext.Provider>
  );

  return scene;
}

export async function resetScenes() {
  await jest.runOnlyPendingTimersAsync();
  jest.useRealTimers();
  getScopesSelectorService().reset();
  getScopesDashboardsService().reset();
  cleanup();
  getMock.mockClear();
}
