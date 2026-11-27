import { isEqual } from 'lodash';

import { FieldConfigProperty, MappingType, store, type ThresholdsConfig, type ValueMapping } from '@grafana/data';
import { hasVarMappingVariableReference, isVarMappingProp, unwrapVarMappingPropId } from '@grafana/data/internal';
import { config, locationService } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { type SceneGridItemLike, type VizPanel } from '@grafana/scenes';
import {
  isTemplateDashboardAssistantEnabled,
  isSuggestedDashboardAssistantEnabled,
} from 'app/features/dashboard/dashgrid/DashboardLibrary/utils/assistantHelpers';
import { getDatasourceTypes } from 'app/features/dashboard/dashgrid/DashboardLibrary/utils/dashboardLibraryHelpers';
import { DASHBOARD_LIBRARY_ROUTES } from 'app/features/dashboard/dashgrid/types';
import { getTextDataUsage } from 'app/plugins/panel/text/dataUsage';
import { type Options, TextMode } from 'app/plugins/panel/text/panelcfg.gen';

import { CustomDashboardTemplateInteractions } from '../analytics/dashboard-templates/main';
import { type DashboardScene } from '../scene/DashboardScene';
import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';

import { type DashboardEditSessionTracking } from './dashboardModeTracking';
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
  trackTablePanelUsage(dashboard);
  trackPanelOptionVariableUsage(dashboard, 'load');
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
  } & Partial<DashboardEditSessionTracking>
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

  trackPanelOptionVariableUsage(dashboard, 'save');

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

function trackTablePanelUsage(dashboard: DashboardScene) {
  const flags = getFeatureFlagClient();

  if (!flags.getBooleanValue(FlagKeys.TableRefreshNewFeatures, false)) {
    return;
  }

  const tablePanelCount = dashboard.state.body
    .getVizPanels()
    .filter((panel) => panel.state.pluginId === 'table').length;

  if (tablePanelCount === 0) {
    return;
  }

  DashboardInteractions.tablePanelUsage({
    dashboard_uid: dashboard.state.uid,
    table_panel_count: tablePanelCount,
  });
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
    const dataUsage = getTextDataUsage(options);

    if (options.mode !== TextMode.Code) {
      if (MERMAID_PATTERN.test(content)) {
        usage.mermaid_count++;
      }

      if (dataUsage.handlebars) {
        usage.handlebars_count++;
      }
    }

    if (dataUsage.dataMacros) {
      usage.data_macro_count++;
    }

    if (dataUsage.perRow) {
      usage.per_row_count++;
    }
  }

  return usage;
}

/**
 * Each open dashboard's usage when it loaded or was last saved, so a save only reports a change. Saves carry the
 * options and loads don't, so the options count what dashboards hold rather than how often they're viewed.
 */
const panelOptionVariableUsageBaselines = new WeakMap<
  DashboardScene,
  { uid: string; usage: PanelOptionVariableUsage }
>();

const NO_PANEL_OPTION_VARIABLE_USAGE: PanelOptionVariableUsage = {
  panel_count: 0,
  field_config_count: 0,
  threshold_count: 0,
  value_mapping_count: 0,
  options: '',
};

/**
 * Counts the panels whose saved field config sets options from variables, so the counts follow what
 * dashboards hold, whichever way an option got or lost its variable
 */
function trackPanelOptionVariableUsage(dashboard: DashboardScene, trigger: 'load' | 'save') {
  if (!dashboard.isV2() || !getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaPanelOptionInterpolation, false)) {
    return;
  }

  const usage = getPanelOptionVariableUsage(dashboard);
  const uid = dashboard.state.uid ?? '';
  const baseline = panelOptionVariableUsageBaselines.get(dashboard);
  panelOptionVariableUsageBaselines.set(dashboard, { uid, usage });

  if (trigger === 'load') {
    const { options, ...counts } = usage;
    if (counts.panel_count > 0) {
      DashboardInteractions.panelOptionVariableUsage({ ...counts, trigger, dashboard_uid: dashboard.state.uid });
    }
    return;
  }

  // A first save or Save as gives the dashboard a new uid, so it is compared with no usage
  const previous = baseline?.uid === uid ? baseline.usage : NO_PANEL_OPTION_VARIABLE_USAGE;
  if (!isEqual(usage, previous)) {
    DashboardInteractions.panelOptionVariableUsage({ ...usage, trigger, dashboard_uid: dashboard.state.uid });
  }
}

interface PanelOptionVariableUsage {
  panel_count: number;
  field_config_count: number;
  threshold_count: number;
  value_mapping_count: number;
  /** The option ids set from variables with how many panels set each, sorted by id: `min:2,unit:1` */
  options: string;
}

function getPanelOptionVariableUsage(dashboard: DashboardScene): PanelOptionVariableUsage {
  const usage = { panel_count: 0, field_config_count: 0, threshold_count: 0, value_mapping_count: 0 };
  const panelsByOption = new Map<string, number>();

  for (const panel of dashboard.state.body.getVizPanels()) {
    const { overrides } = panel.state.fieldConfig;
    const defaults = panel.state.fieldConfig.defaults ?? {};
    const properties = (overrides ?? []).flatMap((rule) => rule.properties ?? []);
    const valuesOf = (id: string) => properties.filter((prop) => prop.id === id).map((prop) => prop.value);

    const mappedIds = [
      ...Object.keys(defaults.varMappings ?? {}),
      ...properties.filter(isVarMappingProp).map((prop) => unwrapVarMappingPropId(prop.id)),
    ];
    const fieldConfig = mappedIds.length > 0;
    const thresholds = [defaults.thresholds, ...valuesOf(FieldConfigProperty.Thresholds)].some(hasThresholdVariable);
    const valueMappings = [defaults.mappings, ...valuesOf(FieldConfigProperty.Mappings)].some(hasValueMappingVariable);

    // A set, so an option mapped in both the defaults and an override counts the panel once
    const optionIds = new Set(mappedIds);
    if (thresholds) {
      optionIds.add(FieldConfigProperty.Thresholds);
    }
    if (valueMappings) {
      optionIds.add(FieldConfigProperty.Mappings);
    }
    optionIds.forEach((id) => panelsByOption.set(id, (panelsByOption.get(id) ?? 0) + 1));

    usage.field_config_count += Number(fieldConfig);
    usage.threshold_count += Number(thresholds);
    usage.value_mapping_count += Number(valueMappings);
    usage.panel_count += Number(fieldConfig || thresholds || valueMappings);
  }

  const options = [...panelsByOption.keys()]
    .sort()
    .map((id) => `${id}:${panelsByOption.get(id)}`)
    .join(',');

  return { ...usage, options };
}

function hasThresholdVariable(thresholds: ThresholdsConfig | undefined): boolean {
  return Boolean(thresholds?.steps?.some((step) => step.valueExpr));
}

function hasValueMappingVariable(mappings: ValueMapping[] | undefined): boolean {
  return Boolean(
    mappings?.some((mapping) => {
      const results =
        mapping.type === MappingType.ValueToText ? Object.values(mapping.options ?? {}) : [mapping.options?.result];
      return results.some((result) => typeof result?.text === 'string' && hasVarMappingVariableReference(result.text));
    })
  );
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
