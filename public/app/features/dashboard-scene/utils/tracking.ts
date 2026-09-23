import { store } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { type SceneGridItemLike, type VizPanel } from '@grafana/scenes';
import {
  isTemplateDashboardAssistantEnabled,
  isSuggestedDashboardAssistantEnabled,
} from 'app/features/dashboard/dashgrid/DashboardLibrary/utils/assistantHelpers';
import { getDatasourceTypes } from 'app/features/dashboard/dashgrid/DashboardLibrary/utils/dashboardLibraryHelpers';
import { DASHBOARD_LIBRARY_ROUTES } from 'app/features/dashboard/dashgrid/types';
import { type Options, RenderMode, TextMode } from 'app/plugins/panel/text/panelcfg.gen';

import { CustomDashboardTemplateInteractions } from '../analytics/dashboard-templates/main';
import { type DashboardScene } from '../scene/DashboardScene';
import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';

import { DashboardInteractions } from './interactions';

export function trackDashboardSceneLoaded(dashboard: DashboardScene, duration?: number) {
  const dynamicDashboardsTrackingInformation = dashboard.getDynamicDashboardsTrackingInformation();

  DashboardInteractions.dashboardInitialized({
    theme: undefined,
    duration,
    isScene: true,
    hasEditPermissions: dashboard.canEditDashboard(),
    hasSavePermissions: Boolean(dashboard.state.meta.canSave),
    ...(dashboard.getTrackingInformation() ?? {}),
    ...(dynamicDashboardsTrackingInformation
      ? {
          tabCount: dynamicDashboardsTrackingInformation.tabCount,
          templateVariableCount: dynamicDashboardsTrackingInformation.templateVariableCount,
          maxNestingLevel: dynamicDashboardsTrackingInformation.maxNestingLevel,
          dashStructure: dynamicDashboardsTrackingInformation.dashStructure,
          conditionalRenderRules: dynamicDashboardsTrackingInformation.conditionalRenderRulesCount,
          autoLayoutCount: dynamicDashboardsTrackingInformation.autoLayoutCount,
          customGridLayoutCount: dynamicDashboardsTrackingInformation.customGridLayoutCount,
        }
      : {}),
  });

  trackTextPanelUsage(dashboard);
}

export const trackDashboardSceneEditButtonClicked = (dashboardUid?: string) => {
  DashboardInteractions.editButtonClicked({
    outlineExpanded: !store.getBool('grafana.dashboard.sidebar.outline.collapsed', false),
    dashboardUid,
  });
};

export async function trackDashboardSceneCreatedOrSaved(
  isNew: boolean,
  dashboard: DashboardScene,
  initialProperties: {
    name: string;
    url: string;
    diff_count: number;
    transformation_counts?: Record<string, number>;
    expression_counts?: Record<string, number>;
  }
) {
  const sceneDashboardTrackingInfo = dashboard.getTrackingInformation();
  const dynamicDashboardsTrackingInformation = dashboard.getDynamicDashboardsTrackingInformation();

  // Extract variable type counts from tracking info
  const variables = Object.entries(sceneDashboardTrackingInfo ?? {})
    .filter(([key]) => /^variable_type_.+_count$/.test(key))
    .reduce<Record<string, number>>((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});

  const dashboardLibraryProperties = await getDashboardLibraryTrackingProperties(dashboard);

  DashboardInteractions.dashboardCreatedOrSaved(isNew, {
    ...initialProperties,
    ...(dynamicDashboardsTrackingInformation
      ? {
          uid: dashboard.state.uid || '',
          numPanels: dynamicDashboardsTrackingInformation.panelCount,
          numTabs: dynamicDashboardsTrackingInformation.tabCount,
          numRows: dynamicDashboardsTrackingInformation.rowCount,
          conditionalRenderRules: dynamicDashboardsTrackingInformation.conditionalRenderRulesCount,
          autoLayoutCount: dynamicDashboardsTrackingInformation.autoLayoutCount,
          customGridLayoutCount: dynamicDashboardsTrackingInformation.customGridLayoutCount,
          panelsByDatasourceType: dynamicDashboardsTrackingInformation.panelsByDatasourceType,
          ...variables,
          ...dashboardLibraryProperties,
        }
      : {
          uid: dashboard.state.uid || '',
          numPanels: sceneDashboardTrackingInfo?.panels_count || 0,
          numRows: sceneDashboardTrackingInfo?.rowCount || 0,
          ...variables,
          ...dashboardLibraryProperties,
        }),
  });

  if (getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaCustomDashboardTemplates, false) && isNew) {
    const { pathname, search } = locationService.getLocation();
    const isOnTemplateRoute = pathname === DASHBOARD_LIBRARY_ROUTES.Template;
    const templateUid = new URLSearchParams(search).get('dashboardTemplateUid');
    if (isOnTemplateRoute && templateUid) {
      CustomDashboardTemplateInteractions.dashboardSavedFromTemplate({
        dashboardUid: dashboard.state.uid ?? '',
        templateUid,
      });
    }
  }
}

export function trackDropItemCrossLayout(gridItem: SceneGridItemLike) {
  // only track panels for now
  if (gridItem instanceof AutoGridItem || gridItem instanceof DashboardGridItem) {
    DashboardInteractions.trackMoveItem('panel', 'drop', {
      isCrossLayout: true,
    });
  }
}

const TEXT_PANEL_PLUGIN_ID = 'text';

const MERMAID_PATTERN = /(?:```|~~~)[ \t]*mermaid|class=["'][^"']*\bmermaid\b/i;
const HANDLEBARS_PATTERN = /\{\{[^}]*\}\}/;
const DATA_MACRO_PATTERN = /\$\{__(value|field|data|series)\b/;

function trackTextPanelUsage(dashboard: DashboardScene) {
  if (!isTextV2WithNewFeatures()) {
    return;
  }

  const usage = getTextPanelUsage(dashboard.state.body.getVizPanels());

  if (usage) {
    DashboardInteractions.textPanelUsage({ ...usage, dashboard_uid: dashboard.state.uid });
  }
}

function isTextV2WithNewFeatures() {
  const flags = getFeatureFlagClient();

  return (
    flags.getBooleanValue(FlagKeys.GrafanaNewTextPanel, false) && flags.getBooleanValue(FlagKeys.TextNewFeatures, false)
  );
}

function getTextPanelUsage(panels: VizPanel[]) {
  const textPanels = panels.filter((panel) => panel.state.pluginId === TEXT_PANEL_PLUGIN_ID);

  if (textPanels.length === 0) {
    return undefined;
  }

  const usage = {
    mermaid_count: 0,
    handlebars_count: 0,
    data_macro_count: 0,
    per_row_count: 0,
  };

  for (const panel of textPanels) {
    const options: Partial<Options> = panel.state.options;
    const content = options.content ?? '';

    if (options.mode !== TextMode.Code) {
      if (MERMAID_PATTERN.test(content)) {
        usage.mermaid_count++;
      }

      if (HANDLEBARS_PATTERN.test(content)) {
        usage.handlebars_count++;
      }
    }

    if (DATA_MACRO_PATTERN.test(content)) {
      usage.data_macro_count++;
    }

    if (options.renderMode === RenderMode.PerRow) {
      usage.per_row_count++;
    }
  }

  return usage;
}

async function getDashboardLibraryTrackingProperties(dashboard: DashboardScene) {
  const isDashboardLibraryEnabled =
    config.featureToggles.dashboardLibrary ||
    config.featureToggles.dashboardTemplates ||
    config.featureToggles.suggestedDashboards;

  if (!isDashboardLibraryEnabled) {
    return {};
  }

  // url values for dashboard library experiment
  const urlParams = new URLSearchParams(window.location.search);
  const sourceEntryPoint = urlParams.get('sourceEntryPoint') || undefined;
  // For community dashboards, use gnetId as libraryItemId if libraryItemId is not present
  const libraryItemId = urlParams.get('libraryItemId') || urlParams.get('gnetId') || undefined;
  const creationOrigin = urlParams.get('creationOrigin') || undefined;
  const assistantSource = urlParams.get('assistantSource') || undefined;

  // Extract datasourceTypes from URL params (supports both community and provisioned dashboards) or dashboard panels
  const datasourceTypes = getDatasourceTypes(dashboard);

  const isDashboardTemplatesAssistantEnabled = await isTemplateDashboardAssistantEnabled();
  const isSuggestedDashboardAssistantButtonEnabled = await isSuggestedDashboardAssistantEnabled();

  return {
    isDashboardTemplatesEnabled: config.featureToggles.dashboardTemplates ?? false,
    isDashboardTemplatesAssistantEnabled,
    isSuggestedDashboardAssistantButtonEnabled,
    datasourceTypes,
    sourceEntryPoint,
    libraryItemId,
    creationOrigin,
    ...(assistantSource && { assistantSource }),
  };
}
