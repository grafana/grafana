import { useCallback } from 'react';

import { DataTransformerConfig } from '@grafana/data';
import { config, useLocationService, usePluginComponents } from '@grafana/runtime';
import { SceneDataQuery, SceneDataTransformer, SceneQueryRunner } from '@grafana/scenes';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

type InsightFinderPanelType =
  | 'barchart'
  | 'piechart'
  | 'stat'
  | 'table'
  | 'timeseries'
  | 'bmc-table-panel'
  | 'gauge'
  | 'bargauge'
  | string;

interface InsightFinderPanelDatasource {
  type: string;
  uid: string;
}

// The insight finder extension addPanel function expects a panel object with the following properties:
// - title: string
// - description?: string
// - panel_type: InsightFinderPanelType
// - datasource: InsightFinderPanelDatasource
// - query_type: InsightFinderPanelQueryType
// - query: any
// - targetQuery: SceneDataQuery[]
export interface InsightFinderPanel {
  title: string;
  description?: string;
  panel_type: InsightFinderPanelType;
  datasource: InsightFinderPanelDatasource;
  query: any;
  targetQuery: SceneDataQuery[];
  transformations?: DataTransformerConfig[];
}

interface InsightFinderNavbarActionProps {
  dashboard: DashboardModel | undefined;
  onPanelAdd: (panel: InsightFinderPanel) => void;
}

/**
 * Hook for managing Insight Finder panel components and panel addition functionality.
 */
export default function useInsightFinderHook() {
  const locationService = useLocationService();
  const onPanelAdd = useCallback(
    async (panel: InsightFinderPanel) => {
      let dashboard = getDashboardSrv()?.dashboard;
      const isNewDashboard = dashboard?.meta?.isNew || false;
      // If we are already on edit dashboard page
      // We need to exit the edit mode first
      if (dashboard && !isNewDashboard) {
        if (config.featureToggles.dashboardScene) {
          const scene = (dashboard as any)?._scene as DashboardScene | undefined;
          if (scene?.state?.isEditing) {
            scene.exitEditMode({ skipConfirm: true, restoreInitialState: false });
          }
        } else if (dashboard.panelInEdit) {
          dashboard.exitPanelEditor();
        }
      }

      // If we're not already on the "new dashboard" route, navigate there first
      // On Edit and View Panel we want to navigate to the new dashboard page again
      const currentLocation = locationService.getLocation();
      if (
        currentLocation?.pathname !== '/dashboard/new' ||
        currentLocation.search.includes('viewPanel') ||
        currentLocation.search.includes('editPanel')
      ) {
        locationService.push('/dashboard/new');
      }

      // Wait until Grafana initializes a dashboard instance for the new route.
      // Poll a few times instead of assuming a fixed delay is enough.
      let attempts = 0;

      while (attempts < 3 && (!isNewDashboard || !dashboard)) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        dashboard = getDashboardSrv()?.dashboard;
        attempts++;
      }

      if (!dashboard) {
        console.error('Dashboard context not found when trying to add Insight Finder panel');
        return;
      }

      if (!panel?.datasource?.type || !panel?.datasource?.uid) {
        console.error('Invalid Insight Finder panel definition: missing datasource information', panel);
        return;
      }
      // Adding tag as Insight Finder panel to the dashboard
      if (!dashboard.tags.find((tag: string) => tag === 'Insight Finder')) {
        dashboard.tags.push('Insight Finder');
      }

      if (config.featureToggles.dashboardScene) {
        onScenePanelAdd(panel, (dashboard as any)?._scene as DashboardScene);
      } else {
        onOldPanelAdd(panel, dashboard);
      }
    },
    [locationService]
  );

  const onOldPanelAdd = (panel: InsightFinderPanel, dashboard: DashboardModel) => {
    const panelJSON = getPanelJSON(panel);
    dashboard.addPanel(panelJSON);
  };

  const onScenePanelAdd = (panel: InsightFinderPanel, dashboard: DashboardScene) => {
    const queries = panel.targetQuery;
    const defaultOptions = getPanelDefaultOptions(panel.panel_type) as any;
    const queryRunner = new SceneQueryRunner({
      datasource: {
        type: panel.datasource.type,
        uid: panel.datasource.uid,
      },
      queries,
    });
    const vizPanel = dashboard.onCreateNewPanel();
    vizPanel.setState({
      title: panel.title,
      description: panel.description,
      pluginId: panel.panel_type,
      $data: new SceneDataTransformer({
        transformations: panel.transformations ?? [],
        $data: queryRunner,
      }),
      ...defaultOptions,
    });
  };

  const { components } = usePluginComponents<InsightFinderNavbarActionProps>({
    extensionPointId: 'bmc/insight-finder/navbar-actions',
  });

  const InsightFinderComponent = useCallback(() => {
    if (!components.length) {
      return null;
    }
    const pluginId = 'bmc-insightfinder-app';
    const dashboard = getDashboardSrv()?.dashboard;
    const InsightFinderComp = components.find((component) => component.meta.pluginId === pluginId);

    if (!InsightFinderComp) {
      return null;
    }

    return <InsightFinderComp dashboard={dashboard as DashboardModel} onPanelAdd={onPanelAdd} />;
  }, [components, onPanelAdd]);

  return {
    InsightFinderComponent,
  };
}

const getPanelJSON = (panel: InsightFinderPanel) => {
  const defaultOptions = getPanelDefaultOptions(panel.panel_type);
  return {
    title: panel.title,
    description: panel.description,
    type: panel.panel_type,
    datasource: {
      type: panel.datasource.type,
      uid: panel.datasource.uid,
    },
    targets: panel.targetQuery,
    ...defaultOptions,
    transformations: panel.transformations ?? [],
  };
};

const getPanelDefaultOptions = (type: InsightFinderPanelType) => {
  switch (type) {
    case 'barchart':
      return {
        gridPos: { x: 0, y: 0, w: 10, h: 8 },
        options: BARCHART_DEFAULT_OPTIONS.options,
        fieldConfig: BARCHART_DEFAULT_OPTIONS.fieldConfig,
      };
    case 'piechart':
      return {
        gridPos: { x: 0, y: 0, w: 10, h: 8 },
        options: PIECHART_DEFAULT_OPTIONS.options,
        fieldConfig: PIECHART_DEFAULT_OPTIONS.fieldConfig,
      };
    case 'stat':
      return {
        gridPos: { x: 0, y: 0, w: 10, h: 8 },
        options: STAT_DEFAULT_OPTIONS.options,
        fieldConfig: STAT_DEFAULT_OPTIONS.fieldConfig,
      };
    case 'table':
      return {
        gridPos: { x: 0, y: 0, w: 10, h: 8 },
        options: TABLE_DEFAULT_OPTIONS.options,
        fieldConfig: TABLE_DEFAULT_OPTIONS.fieldConfig,
      };
    case 'timeseries':
      return {
        gridPos: { x: 0, y: 0, w: 10, h: 8 },
        options: TIMESERIES_DEFAULT_OPTIONS.options,
        fieldConfig: TIMESERIES_DEFAULT_OPTIONS.fieldConfig,
      };
    case 'bmc-table-panel':
      return {
        gridPos: { x: 0, y: 0, w: 10, h: 8 },
        options: BMC_TABLE_DEFAULT_OPTIONS.options,
        fieldConfig: BMC_TABLE_DEFAULT_OPTIONS.fieldConfig,
      };
    case 'gauge':
      return {
        gridPos: { x: 0, y: 0, w: 10, h: 8 },
        options: GAUGE_DEFAULT_OPTIONS.options,
        fieldConfig: GAUGE_DEFAULT_OPTIONS.fieldConfig,
      };
    case 'bargauge':
      return {
        gridPos: { x: 0, y: 0, w: 10, h: 8 },
        options: BARGAUGE_DEFAULT_OPTIONS.options,
        fieldConfig: BARGAUGE_DEFAULT_OPTIONS.fieldConfig,
      };
    default:
      return {
        gridPos: { x: 0, y: 0, w: 10, h: 8 },
        options: {},
        fieldConfig: {
          defaults: {
            custom: {},
          },
          overrides: [],
        },
      };
  }
};

const BMC_TABLE_DEFAULT_OPTIONS = {
  fieldConfig: {
    defaults: {
      custom: {
        type: 'auto',
        fontSize: 14,
        cellOptions: {
          type: 'auto',
        },
        merge: false,
        width: 150,
        alignment: 'auto',
        hidden: false,
      },
      mappings: [],
      thresholds: {
        mode: 'absolute',
        steps: [
          {
            value: null,
            color: 'green',
          },
          {
            value: 80,
            color: 'red',
          },
        ],
      },
      color: {
        mode: 'thresholds',
      },
    },
    overrides: [],
  },
  options: {
    general: {
      header: true,
      grid: true,
      search: false,
      sort: true,
      transpose: false,
    },
    footer: {
      show: false,
      showTotalRows: false,
      pagination: false,
      rowsPerPage: 5,
      reducer: [],
      fields: [],
    },
    column: {
      minWidth: 150,
    },
    cell: {
      inspect: true,
      tooltip: true,
      height: 'dynamic',
      autoFillHeight: false,
    },
  },
};

const PIECHART_DEFAULT_OPTIONS = {
  fieldConfig: {
    defaults: {
      custom: {
        hideFrom: {
          tooltip: false,
          viz: false,
          legend: false,
        },
      },
      color: {
        mode: 'palette-classic',
      },
      mappings: [],
    },
    overrides: [],
  },
  options: {
    reduceOptions: {
      values: true,
      calcs: ['lastNotNull'],
      fields: '',
    },
    pieType: 'pie',
    tooltip: {
      mode: 'single',
      sort: 'none',
      hideZeros: false,
    },
    legend: {
      showLegend: true,
      displayMode: 'table',
      placement: 'right',
      values: ['percent', 'value'],
    },
    displayLabels: ['value'],
  },
};

const TABLE_DEFAULT_OPTIONS = {
  fieldConfig: {
    defaults: {
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
            value: null,
            color: 'green',
          },
          {
            value: 80,
            color: 'red',
          },
        ],
      },
      color: {
        mode: 'continuous-GrYlRd',
      },
    },
    overrides: [],
  },
  options: {
    showHeader: true,
    cellHeight: 'sm',
    footer: {
      show: false,
      reducer: ['sum'],
      countRows: false,
      fields: '',
    },
  },
};

const BARGAUGE_DEFAULT_OPTIONS = {
  options: {
    reduceOptions: {
      values: true,
      calcs: ['sum'],
      fields: '',
    },
    orientation: 'horizontal',
    legend: {
      showLegend: false,
      displayMode: 'list',
      placement: 'bottom',
      calcs: [],
    },
    displayMode: 'lcd',
    valueMode: 'color',
    namePlacement: 'auto',
    showUnfilled: true,
    sizing: 'auto',
    minVizWidth: 8,
    minVizHeight: 16,
    maxVizHeight: 300,
  },
  fieldConfig: {
    defaults: {
      mappings: [],
      thresholds: {
        mode: 'absolute',
        steps: [
          {
            value: null,
            color: 'green',
          },
          {
            value: 80,
            color: 'red',
          },
        ],
      },
      color: {
        mode: 'continuous-GrYlRd',
      },
    },
    overrides: [],
  },
};

const GAUGE_DEFAULT_OPTIONS = {
  fieldConfig: {
    defaults: {
      mappings: [],
      thresholds: {
        mode: 'absolute',
        steps: [
          {
            value: null,
            color: 'green',
          },
          {
            value: 80,
            color: 'red',
          },
        ],
      },
      color: {
        mode: 'thresholds',
      },
    },
    overrides: [],
  },
  options: {
    reduceOptions: {
      values: false,
      calcs: ['sum'],
      fields: '',
    },
    orientation: 'auto',
    showThresholdLabels: false,
    showThresholdMarkers: true,
    sizing: 'auto',
    minVizWidth: 75,
    minVizHeight: 75,
  },
};

const STAT_DEFAULT_OPTIONS = {
  options: {
    reduceOptions: {
      values: false,
      calcs: ['sum'],
      fields: '',
    },
    orientation: 'auto',
    textMode: 'auto',
    wideLayout: true,
    colorMode: 'value',
    graphMode: 'area',
    justifyMode: 'auto',
    showPercentChange: false,
    percentChangeColorMode: 'standard',
  },
  fieldConfig: {
    defaults: {
      mappings: [],
      thresholds: {
        mode: 'absolute',
        steps: [
          {
            value: null,
            color: 'green',
          },
          {
            value: 80,
            color: 'red',
          },
        ],
      },
      color: {
        mode: 'thresholds',
      },
    },
    overrides: [],
  },
};

const TIMESERIES_DEFAULT_OPTIONS = {
  fieldConfig: {
    defaults: {
      custom: {
        drawStyle: 'line',
        lineInterpolation: 'linear',
        barAlignment: 0,
        barWidthFactor: 0.6,
        lineWidth: 1,
        fillOpacity: 0,
        gradientMode: 'none',
        spanNulls: false,
        insertNulls: false,
        showPoints: 'auto',
        pointSize: 5,
        stacking: {
          mode: 'none',
          group: 'A',
        },
        axisPlacement: 'auto',
        axisLabel: '',
        axisColorMode: 'text',
        axisBorderShow: false,
        scaleDistribution: {
          type: 'linear',
        },
        axisCenteredZero: false,
        hideFrom: {
          tooltip: false,
          viz: false,
          legend: false,
        },
        thresholdsStyle: {
          mode: 'off',
        },
      },
      color: {
        mode: 'palette-classic',
      },
      mappings: [],
      thresholds: {
        mode: 'absolute',
        steps: [
          {
            value: null,
            color: 'green',
          },
          {
            value: 80,
            color: 'red',
          },
        ],
      },
    },
    overrides: [],
  },
  options: {
    tooltip: {
      mode: 'single',
      sort: 'none',
      hideZeros: false,
    },
    legend: {
      showLegend: true,
      displayMode: 'list',
      placement: 'bottom',
      calcs: [],
    },
  },
};

const BARCHART_DEFAULT_OPTIONS = {
  options: {
    orientation: 'auto',
    xTickLabelRotation: 0,
    xTickLabelSpacing: 0,
    showValue: 'auto',
    stacking: 'none',
    groupWidth: 0.7,
    barWidth: 0.97,
    barRadius: 0,
    fullHighlight: false,
    tooltip: {
      mode: 'single',
      sort: 'none',
      hideZeros: false,
    },
    legend: {
      showLegend: true,
      displayMode: 'table',
      placement: 'right',
      calcs: [],
    },
  },
  fieldConfig: {
    defaults: {
      custom: {
        lineWidth: 1,
        fillOpacity: 80,
        gradientMode: 'none',
        axisPlacement: 'auto',
        axisLabel: '',
        axisColorMode: 'text',
        axisBorderShow: false,
        scaleDistribution: {
          type: 'linear',
        },
        axisCenteredZero: false,
        hideFrom: {
          tooltip: false,
          viz: false,
          legend: false,
        },
        thresholdsStyle: {
          mode: 'off',
        },
      },
      color: {
        mode: 'palette-classic',
      },
      mappings: [],
      thresholds: {
        mode: 'absolute',
        steps: [
          {
            value: null,
            color: 'green',
          },
          {
            value: 80,
            color: 'red',
          },
        ],
      },
    },
    overrides: [],
  },
};
