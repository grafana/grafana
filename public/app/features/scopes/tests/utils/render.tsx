import { KBarProvider } from 'kbar';
import { render } from 'test/test-utils';

import { defaultDashboard } from '@grafana/schema';
import { AppChrome } from 'app/core/components/AppChrome/AppChrome';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { transformSaveModelToScene } from 'app/features/dashboard-scene/serialization/transformSaveModelToScene';
import { DashboardDataDTO, DashboardDTO, DashboardMeta } from 'app/types';

import { scopesDashboardsScene, scopesSelectorScene } from '../../instance';
import { getInitialDashboardsState } from '../../internal/ScopesDashboardsScene';
import { initialSelectorState } from '../../internal/ScopesSelectorScene';
import { DASHBOARDS_OPENED_KEY } from '../../internal/const';

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

export function buildTestScene(
  overrideDashboard: Partial<DashboardDataDTO> = {},
  overrideMeta: Partial<DashboardMeta> = {}
) {
  const dto: DashboardDTO = getDashboardDTO(overrideDashboard, overrideMeta);

  return transformSaveModelToScene(dto);
}

export function renderDashboard(dashboardScene: DashboardScene) {
  return render(
    <KBarProvider>
      <AppChrome>
        <dashboardScene.Component model={dashboardScene} />
      </AppChrome>
    </KBarProvider>
  );
}

export function resetScenes() {
  scopesSelectorScene?.setState(initialSelectorState);

  localStorage.removeItem(DASHBOARDS_OPENED_KEY);

  scopesDashboardsScene?.setState(getInitialDashboardsState());
}
