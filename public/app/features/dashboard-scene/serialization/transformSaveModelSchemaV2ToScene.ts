import { uniqueId } from 'lodash';

import { config, getDataSourceSrv } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  AdHocFilterWithLabels,
  behaviors,
  ConstantVariable,
  CustomVariable,
  DataSourceVariable,
  GroupByVariable,
  IntervalVariable,
  QueryVariable,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariable,
  SceneVariableSet,
  ScopesVariable,
  SwitchVariable,
  TextBoxVariable,
} from '@grafana/scenes';
import {
  AdhocVariableKind,
  ConstantVariableKind,
  CustomVariableKind,
  Spec as DashboardV2Spec,
  DatasourceVariableKind,
  defaultAdhocVariableKind,
  defaultConstantVariableKind,
  defaultCustomVariableKind,
  defaultDatasourceVariableKind,
  defaultGroupByVariableKind,
  defaultIntervalVariableKind,
  defaultQueryVariableKind,
  defaultTextVariableKind,
  defaultSwitchVariableKind,
  defaultTimeSettingsSpec,
  GroupByVariableKind,
  IntervalVariableKind,
  LibraryPanelKind,
  PanelKind,
  QueryVariableKind,
  SwitchVariableKind,
  TextVariableKind,
  defaultDataQueryKind,
  AnnotationQueryKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { DEFAULT_ANNOTATION_COLOR } from '@grafana/ui';
import {
  AnnoKeyCreatedBy,
  AnnoKeyFolder,
  AnnoKeyUpdatedBy,
  AnnoKeyUpdatedTimestamp,
  AnnoKeyDashboardIsSnapshot,
  AnnoKeyEmbedded,
} from 'app/features/apiserver/types';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import {
  getDashboardSceneProfilerWithMetadata,
  enablePanelProfilingForDashboard,
  getDashboardComponentInteractionCallback,
} from 'app/features/dashboard/services/DashboardProfiler';
import { DashboardMeta } from 'app/types/dashboard';

import { addPanelsOnLoadBehavior } from '../addToDashboard/addPanelsOnLoadBehavior';
import { dashboardAnalyticsInitializer } from '../behaviors/DashboardAnalyticsInitializerBehavior';
import { AlertStatesDataLayer } from '../scene/AlertStatesDataLayer';
import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardControls } from '../scene/DashboardControls';
import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { registerDashboardMacro } from '../scene/DashboardMacro';
import { DashboardReloadBehavior } from '../scene/DashboardReloadBehavior';
import { DashboardScene } from '../scene/DashboardScene';
import { DashboardLayoutManager } from '../scene/types/DashboardLayoutManager';
import { getIntervalsFromQueryString } from '../utils/utils';

import { transformV2ToV1AnnotationQuery } from './annotations';
import { SnapshotVariable } from './custom-variables/SnapshotVariable';
import { layoutDeserializerRegistry } from './layoutSerializers/layoutSerializerRegistry';
import { getDataSourceForQuery, getRuntimeVariableDataSource } from './layoutSerializers/utils';
import { registerPanelInteractionsReporter } from './transformSaveModelToScene';
import {
  transformCursorSyncV2ToV1,
  transformSortVariableToEnumV1,
  transformVariableHideToEnumV1,
  transformVariableRefreshToEnumV1,
} from './transformToV1TypesUtils';
import { LEGACY_STRING_VALUE_KEY } from './transformToV2TypesUtils';

const DEFAULT_DATASOURCE = 'default';

export type TypedVariableModelV2 =
  | QueryVariableKind
  | TextVariableKind
  | ConstantVariableKind
  | DatasourceVariableKind
  | IntervalVariableKind
  | CustomVariableKind
  | GroupByVariableKind
  | AdhocVariableKind
  | SwitchVariableKind;

export function transformSaveModelSchemaV2ToScene(dto: DashboardWithAccessInfo<DashboardV2Spec>): DashboardScene {
  const { spec: dashboard, metadata, apiVersion } = dto;

  const found = dashboard.annotations.some((item) => item.spec.builtIn);
  if (!found) {
    dashboard.annotations.unshift(getGrafanaBuiltInAnnotation());
  }

  const annotationLayers = dashboard.annotations.map((annotation) => {
    const annotationQuerySpec = transformV2ToV1AnnotationQuery(annotation);

    const layerState = {
      key: uniqueId('annotations-'),
      query: annotationQuerySpec,
      name: annotation.spec.name,
      isEnabled: Boolean(annotation.spec.enable),
      isHidden: Boolean(annotation.spec.hide),
      placement: annotation.spec.placement,
    };

    return new DashboardAnnotationsDataLayer(layerState);
  });

  // Create alert states data layer if unified alerting is enabled
  let alertStatesLayer: AlertStatesDataLayer | undefined;
  if (config.unifiedAlertingEnabled) {
    alertStatesLayer = new AlertStatesDataLayer({
      key: 'alert-states',
      name: 'Alert States',
    });
  }

  const isDashboardEditable = Boolean(dashboard.editable);
  const canSave = dto.access.canSave !== false;

  const meta: DashboardMeta = {
    canShare: dto.access.canShare !== false,
    canSave,
    canStar: dto.access.canStar !== false,
    canEdit: dto.access.canEdit !== false,
    canDelete: dto.access.canDelete !== false,
    canAdmin: dto.access.canAdmin !== false,
    url: dto.access.url,
    slug: dto.access.slug,
    annotationsPermissions: dto.access.annotationsPermissions,
    created: metadata.creationTimestamp,
    createdBy: metadata.annotations?.[AnnoKeyCreatedBy],
    updated: metadata.annotations?.[AnnoKeyUpdatedTimestamp],
    updatedBy: metadata.annotations?.[AnnoKeyUpdatedBy],
    folderUid: metadata.annotations?.[AnnoKeyFolder],
    isSnapshot: Boolean(metadata.annotations?.[AnnoKeyDashboardIsSnapshot]),
    isEmbedded: Boolean(metadata.annotations?.[AnnoKeyEmbedded]),
    publicDashboardEnabled: dto.access.isPublic,

    // UI-only metadata, ref: DashboardModel.initMeta
    showSettings: Boolean(dto.access.canEdit),
    canMakeEditable: canSave && !isDashboardEditable,
    hasUnsavedFolderChange: false,
    version: metadata.generation,
    k8s: metadata,
  };

  // Ref: DashboardModel.initMeta
  if (!isDashboardEditable) {
    meta.canEdit = false;
    meta.canDelete = false;
    meta.canSave = false;
  }

  const layoutManager: DashboardLayoutManager = layoutDeserializerRegistry
    .get(dashboard.layout.kind)
    .deserialize(dashboard.layout, dashboard.elements, dashboard.preload);

  //createLayoutManager(dashboard);

  // Create profiler once and reuse to avoid duplicate metadata setting
  const dashboardProfiler = getDashboardSceneProfilerWithMetadata(metadata.name, dashboard.title);

  const enableProfiling =
    config.dashboardPerformanceMetrics.findIndex((uid) => uid === '*' || uid === metadata.name) !== -1;
  const queryController = new behaviors.SceneQueryController(
    {
      enableProfiling,
    },
    dashboardProfiler
  );

  const interactionTracker = new behaviors.SceneInteractionTracker(
    {
      enableInteractionTracking: enableProfiling,
      onInteractionComplete: getDashboardComponentInteractionCallback(metadata.name, dashboard.title),
    },
    dashboardProfiler
  );

  const dashboardScene = new DashboardScene(
    {
      description: dashboard.description,
      editable: dashboard.editable,
      preload: dashboard.preload,
      isDirty: false,
      links: dashboard.links,
      meta,
      tags: dashboard.tags,
      title: dashboard.title,
      uid: metadata.name,
      version: metadata.generation,
      body: layoutManager,
      $timeRange: new SceneTimeRange({
        // Use defaults when time is empty to match DashboardModel behavior
        from: dashboard.timeSettings.from || defaultTimeSettingsSpec().from,
        to: dashboard.timeSettings.to || defaultTimeSettingsSpec().to,
        fiscalYearStartMonth: dashboard.timeSettings.fiscalYearStartMonth,
        timeZone: dashboard.timeSettings.timezone,
        weekStart: dashboard.timeSettings.weekStart,
        UNSAFE_nowDelay: dashboard.timeSettings.nowDelay,
      }),
      $variables: getVariables(dashboard, meta.isSnapshot ?? false),
      $behaviors: [
        new behaviors.CursorSync({
          sync: transformCursorSyncV2ToV1(dashboard.cursorSync),
        }),
        queryController,
        interactionTracker,
        registerDashboardMacro,
        registerPanelInteractionsReporter,
        new behaviors.LiveNowTimer({ enabled: dashboard.liveNow }),
        addPanelsOnLoadBehavior,
        new DashboardReloadBehavior({
          reloadOnParamsChange: config.featureToggles.reloadDashboardsOnParamsChange && false,
          uid: metadata.name,
        }),
        ...(enableProfiling ? [dashboardAnalyticsInitializer] : []),
      ],
      $data: new DashboardDataLayerSet({
        annotationLayers,
        alertStatesLayer,
      }),
      controls: new DashboardControls({
        timePicker: new SceneTimePicker({
          quickRanges: dashboard.timeSettings.quickRanges,
          defaultQuickRanges: config.quickRanges,
        }),
        refreshPicker: new SceneRefreshPicker({
          refresh: dashboard.timeSettings.autoRefresh,
          intervals: dashboard.timeSettings.autoRefreshIntervals,
          withText: true,
        }),
        hideTimeControls: dashboard.timeSettings.hideTimepicker,
      }),
    },
    'v2'
  );

  dashboardScene.setInitialSaveModel(dto.spec, dto.metadata, apiVersion);

  // Enable panel profiling for this dashboard using the composed SceneRenderProfiler
  enablePanelProfilingForDashboard(dashboardScene, metadata.name);

  return dashboardScene;
}

function getVariables(dashboard: DashboardV2Spec, isSnapshot: boolean): SceneVariableSet | undefined {
  let variables: SceneVariableSet | undefined;

  if (isSnapshot) {
    variables = createVariablesForSnapshot(dashboard);
  } else {
    variables = createVariablesForDashboard(dashboard);
  }

  return variables;
}

function createVariablesForDashboard(dashboard: DashboardV2Spec) {
  const variableObjects = dashboard.variables
    .map((v) => {
      try {
        return createSceneVariableFromVariableModel(v);
      } catch (err) {
        console.error(err);
        return null;
      }
    })
    // TODO: Remove filter
    // Added temporarily to allow skipping non-compatible variables
    .filter((v): v is SceneVariable => Boolean(v));

  // Explicitly disable scopes for public dashboards
  if (config.featureToggles.scopeFilters && !config.publicDashboardAccessToken) {
    variableObjects.push(new ScopesVariable({ enable: true }));
  }

  return new SceneVariableSet({
    variables: variableObjects,
  });
}

export function createSceneVariableFromVariableModel(variable: TypedVariableModelV2): SceneVariable {
  const commonProperties = {
    name: variable.spec.name,
    label: variable.spec.label,
    description: variable.spec.description,
  };
  if (variable.kind === defaultAdhocVariableKind().kind) {
    const ds = getDataSourceForQuery(
      {
        type: variable.group,
        uid: variable.datasource?.name,
      },
      variable.group
    );

    // Separate filters by origin - filters with origin go to originFilters, others go to filters
    const originFilters: AdHocFilterWithLabels[] = [];
    const filters: AdHocFilterWithLabels[] = [];
    variable.spec.filters?.forEach((filter) => (filter.origin ? originFilters.push(filter) : filters.push(filter)));

    const adhocVariableState: AdHocFiltersVariable['state'] = {
      ...commonProperties,
      type: 'adhoc',
      description: variable.spec.description,
      skipUrlSync: variable.spec.skipUrlSync,
      hide: transformVariableHideToEnumV1(variable.spec.hide),
      datasource: ds,
      applyMode: 'auto',
      filters,
      originFilters,
      baseFilters: variable.spec.baseFilters ?? [],
      defaultKeys: variable.spec.defaultKeys.length ? variable.spec.defaultKeys : undefined,
      useQueriesAsFilterForOptions: true,
      drilldownRecommendationsEnabled: config.featureToggles.drilldownRecommendations,
      layout: config.featureToggles.newFiltersUI ? 'combobox' : undefined,
      supportsMultiValueOperators: Boolean(
        getDataSourceSrv().getInstanceSettings({ type: ds?.type })?.meta.multiValueFilterOperators
      ),
      collapsible: config.featureToggles.dashboardAdHocAndGroupByWrapper,
    };
    if (variable.spec.allowCustomValue !== undefined) {
      adhocVariableState.allowCustomValue = variable.spec.allowCustomValue;
    }
    return new AdHocFiltersVariable(adhocVariableState);
  }

  if (variable.kind === defaultCustomVariableKind().kind) {
    return new CustomVariable({
      ...commonProperties,
      value: variable.spec.current?.value ?? '',
      text: variable.spec.current?.text ?? '',
      query: variable.spec.query,
      isMulti: variable.spec.multi,
      allValue: variable.spec.allValue || undefined,
      includeAll: variable.spec.includeAll,
      defaultToAll: Boolean(variable.spec.includeAll),
      skipUrlSync: variable.spec.skipUrlSync,
      hide: transformVariableHideToEnumV1(variable.spec.hide),
      ...(variable.spec.allowCustomValue !== undefined && { allowCustomValue: variable.spec.allowCustomValue }),
      valuesFormat: variable.spec.valuesFormat || 'csv',
    });
  } else if (variable.kind === defaultQueryVariableKind().kind) {
    return new QueryVariable({
      ...commonProperties,
      value: variable.spec.current?.value ?? '',
      text: variable.spec.current?.text ?? '',
      query: getDataQueryForVariable(variable),
      datasource: getRuntimeVariableDataSource(variable),
      sort: transformSortVariableToEnumV1(variable.spec.sort),
      refresh: transformVariableRefreshToEnumV1(variable.spec.refresh),
      regex: variable.spec.regex,
      regexApplyTo: variable.spec.regexApplyTo,
      allValue: variable.spec.allValue || undefined,
      includeAll: variable.spec.includeAll,
      defaultToAll: Boolean(variable.spec.includeAll),
      isMulti: variable.spec.multi,
      skipUrlSync: variable.spec.skipUrlSync,
      hide: transformVariableHideToEnumV1(variable.spec.hide),
      definition: variable.spec.definition,
      ...(variable.spec.allowCustomValue !== undefined && { allowCustomValue: variable.spec.allowCustomValue }),
      ...(variable.spec.staticOptions?.length
        ? {
            staticOptions: variable.spec.staticOptions.map((option) => ({
              label: String(option.text),
              value: String(option.value),
              properties: option.properties,
            })),
          }
        : {}),
      ...(variable.spec.staticOptionsOrder !== undefined && { staticOptionsOrder: variable.spec.staticOptionsOrder }),
    });
  } else if (variable.kind === defaultDatasourceVariableKind().kind) {
    return new DataSourceVariable({
      ...commonProperties,
      value: variable.spec.current?.value ?? '',
      text: variable.spec.current?.text ?? '',
      regex: variable.spec.regex,
      pluginId: variable.spec.pluginId,
      allValue: variable.spec.allValue || undefined,
      includeAll: variable.spec.includeAll,
      defaultToAll: Boolean(variable.spec.includeAll),
      skipUrlSync: variable.spec.skipUrlSync,
      isMulti: variable.spec.multi,
      hide: transformVariableHideToEnumV1(variable.spec.hide),
      defaultOptionEnabled:
        variable.spec.current?.value === DEFAULT_DATASOURCE && variable.spec.current?.text === 'default',
      ...(variable.spec.allowCustomValue !== undefined && { allowCustomValue: variable.spec.allowCustomValue }),
    });
  } else if (variable.kind === defaultIntervalVariableKind().kind) {
    // If query is missing/empty, extract intervals from options instead of using defaults
    let intervals: string[];
    if (variable.spec.query) {
      intervals = getIntervalsFromQueryString(variable.spec.query);
    } else if (variable.spec.options && variable.spec.options.length > 0) {
      // Extract intervals from options when query is missing (matches backend behavior)
      intervals = variable.spec.options.map((opt) => String(opt.value || opt.text)).filter(Boolean);
    } else {
      // Fallback to default intervals only if both query and options are missing
      intervals = getIntervalsFromQueryString('');
    }
    const currentInterval = getCurrentValueForOldIntervalModel(variable, intervals);
    return new IntervalVariable({
      ...commonProperties,
      value: currentInterval,
      intervals: intervals,
      autoEnabled: variable.spec.auto,
      autoStepCount: variable.spec.auto_count,
      autoMinInterval: variable.spec.auto_min,
      refresh: transformVariableRefreshToEnumV1(variable.spec.refresh),
      skipUrlSync: variable.spec.skipUrlSync,
      hide: transformVariableHideToEnumV1(variable.spec.hide),
    });
  } else if (variable.kind === defaultConstantVariableKind().kind) {
    return new ConstantVariable({
      ...commonProperties,
      value: variable.spec.query,
      skipUrlSync: variable.spec.skipUrlSync,
      hide: transformVariableHideToEnumV1(variable.spec.hide),
    });
  } else if (variable.kind === defaultTextVariableKind().kind) {
    let val;
    if (!variable?.spec.current?.value) {
      val = variable.spec.query;
    } else {
      if (typeof variable.spec.current.value === 'string') {
        val = variable.spec.current.value;
      } else {
        val = variable.spec.current.value[0];
      }
    }

    return new TextBoxVariable({
      ...commonProperties,
      value: val,
      skipUrlSync: variable.spec.skipUrlSync,
      hide: transformVariableHideToEnumV1(variable.spec.hide),
    });
  } else if (config.featureToggles.groupByVariable && variable.kind === defaultGroupByVariableKind().kind) {
    const ds = getDataSourceForQuery(
      {
        type: variable.group,
        uid: variable.datasource?.name,
      },
      variable.group
    );

    return new GroupByVariable({
      ...commonProperties,
      datasource: ds,
      value: variable.spec.current?.value || [],
      text: variable.spec.current?.text || [],
      skipUrlSync: variable.spec.skipUrlSync,
      isMulti: variable.spec.multi,
      hide: transformVariableHideToEnumV1(variable.spec.hide),
      wideInput: config.featureToggles.dashboardAdHocAndGroupByWrapper,
      drilldownRecommendationsEnabled: config.featureToggles.drilldownRecommendations,
      // @ts-expect-error
      defaultOptions: variable.options,
      defaultValue: variable.spec.defaultValue
        ? { value: variable.spec.defaultValue.value, text: variable.spec.defaultValue.text }
        : undefined,
    });
  } else if (variable.kind === defaultSwitchVariableKind().kind) {
    return new SwitchVariable({
      ...commonProperties,
      value: variable.spec.current ?? 'false',
      enabledValue: variable.spec.enabledValue ?? 'true',
      disabledValue: variable.spec.disabledValue ?? 'false',
      skipUrlSync: variable.spec.skipUrlSync,
      hide: transformVariableHideToEnumV1(variable.spec.hide),
    });
  } else {
    throw new Error(`Scenes: Unsupported variable type ${variable.kind}`);
  }
}

function getDataQueryForVariable(variable: QueryVariableKind) {
  return LEGACY_STRING_VALUE_KEY in variable.spec.query.spec
    ? (variable.spec.query.spec[LEGACY_STRING_VALUE_KEY] ?? '')
    : variable.spec.query.spec;
}

export function getCurrentValueForOldIntervalModel(variable: IntervalVariableKind, intervals: string[]): string {
  // Handle missing current object or value
  const currentValue = variable.spec.current?.value;
  const selectedInterval = Array.isArray(currentValue) ? currentValue[0] : currentValue;

  // If no intervals are available, return empty string (will use default from IntervalVariable)
  if (intervals.length === 0) {
    return '';
  }

  // If no selected interval, return the first valid interval
  if (!selectedInterval) {
    return intervals[0];
  }

  // If the interval is the old auto format, return the new auto interval from scenes.
  if (selectedInterval.startsWith('$__auto_interval_')) {
    return '$__auto';
  }

  // Check if the selected interval is valid.
  if (intervals.includes(selectedInterval)) {
    return selectedInterval;
  }

  // If the selected interval is not valid, return the first valid interval.
  return intervals[0];
}

export function createVariablesForSnapshot(dashboard: DashboardV2Spec): SceneVariableSet {
  const variableObjects = dashboard.variables
    .map((v) => {
      try {
        // for adhoc we are using the AdHocFiltersVariable from scenes becuase of its complexity
        if (v.kind === 'AdhocVariable') {
          const ds = getDataSourceForQuery(
            {
              type: v.group,
              uid: v.datasource?.name,
            },
            v.group
          );

          return new AdHocFiltersVariable({
            name: v.spec.name,
            label: v.spec.label,
            readOnly: true,
            description: v.spec.description,
            skipUrlSync: v.spec.skipUrlSync,
            hide: transformVariableHideToEnumV1(v.spec.hide),
            datasource: ds,
            applyMode: 'auto',
            filters: v.spec.filters ?? [],
            baseFilters: v.spec.baseFilters ?? [],
            defaultKeys: v.spec.defaultKeys?.length ? v.spec.defaultKeys : undefined,
            useQueriesAsFilterForOptions: true,
            layout: config.featureToggles.newFiltersUI ? 'combobox' : undefined,
            supportsMultiValueOperators: Boolean(
              getDataSourceSrv().getInstanceSettings({ type: ds?.type })?.meta.multiValueFilterOperators
            ),
          });
        }
        // for other variable types we are using the SnapshotVariable
        return createSnapshotVariable(v);
      } catch (err) {
        console.error(err);
        return null;
      }
    })
    // TODO: Remove filter
    // Added temporarily to allow skipping non-compatible variables
    .filter((v): v is SceneVariable => Boolean(v));

  return new SceneVariableSet({
    variables: variableObjects,
  });
}

/** Snapshots variables are read-only and should not be updated */
export function createSnapshotVariable(variable: TypedVariableModelV2): SceneVariable {
  let snapshotVariable: SnapshotVariable;
  let current: { value: string | string[]; text: string | string[] };
  if (variable.kind === 'IntervalVariable') {
    const intervals = getIntervalsFromQueryString(variable.spec.query);
    const currentInterval = getCurrentValueForOldIntervalModel(variable, intervals);
    snapshotVariable = new SnapshotVariable({
      name: variable.spec.name,
      label: variable.spec.label,
      description: variable.spec.description,
      value: currentInterval,
      text: currentInterval,
      hide: transformVariableHideToEnumV1(variable.spec.hide),
    });
    return snapshotVariable;
  }

  if (variable.kind === 'ConstantVariable' || variable.kind === 'AdhocVariable') {
    current = {
      value: '',
      text: '',
    };
  } else if (variable.kind === 'SwitchVariable') {
    current = {
      value: variable.spec.current ?? 'false',
      text: variable.spec.current ?? 'false',
    };
  } else {
    current = {
      value: variable.spec.current?.value ?? '',
      text: variable.spec.current?.text ?? '',
    };
  }

  snapshotVariable = new SnapshotVariable({
    name: variable.spec.name,
    label: variable.spec.label,
    description: variable.spec.description,
    value: current?.value ?? '',
    text: current?.text ?? '',
    hide: transformVariableHideToEnumV1(variable.spec.hide),
  });
  return snapshotVariable;
}

export function getPanelElement(dashboard: DashboardV2Spec, elementName: string): PanelKind | undefined {
  return dashboard.elements[elementName].kind === 'Panel' ? dashboard.elements[elementName] : undefined;
}

export function getLibraryPanelElement(dashboard: DashboardV2Spec, elementName: string): LibraryPanelKind | undefined {
  return dashboard.elements[elementName].kind === 'LibraryPanel' ? dashboard.elements[elementName] : undefined;
}

function getGrafanaBuiltInAnnotation(): AnnotationQueryKind {
  const grafanaBuiltAnnotation: AnnotationQueryKind = {
    kind: 'AnnotationQuery',
    spec: {
      query: {
        kind: 'DataQuery',
        version: defaultDataQueryKind().version,
        group: 'grafana',
        datasource: {
          name: '-- Grafana --',
        },
        spec: {},
      },
      name: 'Annotations & Alerts',
      iconColor: DEFAULT_ANNOTATION_COLOR,
      enable: true,
      hide: true,
      builtIn: true,
    },
  };

  return grafanaBuiltAnnotation;
}
