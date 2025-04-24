import { uniqueId } from 'lodash';

import { config, getDataSourceSrv } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
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
  TextBoxVariable,
} from '@grafana/scenes';
import {
  AdhocVariableKind,
  AnnotationQueryKind,
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
  GroupByVariableKind,
  IntervalVariableKind,
  LibraryPanelKind,
  PanelKind,
  QueryVariableKind,
  TextVariableKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { DEFAULT_ANNOTATION_COLOR } from '@grafana/ui';
import {
  AnnoKeyCreatedBy,
  AnnoKeyFolder,
  AnnoKeyUpdatedBy,
  AnnoKeyUpdatedTimestamp,
  AnnoKeyDashboardIsSnapshot,
  DeprecatedInternalId,
} from 'app/features/apiserver/types';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { DashboardMeta } from 'app/types';

import { addPanelsOnLoadBehavior } from '../addToDashboard/addPanelsOnLoadBehavior';
import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardControls } from '../scene/DashboardControls';
import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { registerDashboardMacro } from '../scene/DashboardMacro';
import { DashboardReloadBehavior } from '../scene/DashboardReloadBehavior';
import { DashboardScene } from '../scene/DashboardScene';
import { DashboardLayoutManager } from '../scene/types/DashboardLayoutManager';
import { preserveDashboardSceneStateInLocalStorage } from '../utils/dashboardSessionState';
import { getIntervalsFromQueryString } from '../utils/utils';

import { SnapshotVariable } from './custom-variables/SnapshotVariable';
import { layoutDeserializerRegistry } from './layoutSerializers/layoutSerializerRegistry';
import { getRuntimeVariableDataSource } from './layoutSerializers/utils';
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
  | AdhocVariableKind;

export function transformSaveModelSchemaV2ToScene(dto: DashboardWithAccessInfo<DashboardV2Spec>): DashboardScene {
  const { spec: dashboard, metadata } = dto;

  // annotations might not come with the builtIn Grafana annotation, we need to add it

  const grafanaBuiltAnnotation = getGrafanaBuiltInAnnotationDataLayer(dashboard);
  if (grafanaBuiltAnnotation) {
    dashboard.annotations.unshift(grafanaBuiltAnnotation);
  }

  const annotationLayers = dashboard.annotations.map((annotation) => {
    let annoQuerySpec = annotation.spec;
    // some annotations will contain in the options properties that need to be
    // added to the root level annotation spec
    if (annoQuerySpec?.options) {
      annoQuerySpec = {
        ...annoQuerySpec,
        ...annoQuerySpec.options,
      };
    }
    return new DashboardAnnotationsDataLayer({
      key: uniqueId('annotations-'),
      query: {
        ...annoQuerySpec,
        builtIn: annotation.spec.builtIn ? 1 : 0,
      },
      name: annotation.spec.name,
      isEnabled: Boolean(annotation.spec.enable),
      isHidden: Boolean(annotation.spec.hide),
    });
  });

  const isDashboardEditable = Boolean(dashboard.editable);
  const canSave = dto.access.canSave !== false;
  let dashboardId: number | undefined = undefined;

  if (metadata.labels?.[DeprecatedInternalId]) {
    dashboardId = parseInt(metadata.labels[DeprecatedInternalId], 10);
  }

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

  const dashboardScene = new DashboardScene(
    {
      description: dashboard.description,
      editable: dashboard.editable,
      preload: dashboard.preload,
      id: dashboardId,
      isDirty: false,
      links: dashboard.links,
      meta,
      tags: dashboard.tags,
      title: dashboard.title,
      uid: metadata.name,
      version: metadata.generation,
      body: layoutManager,
      $timeRange: new SceneTimeRange({
        from: dashboard.timeSettings.from,
        to: dashboard.timeSettings.to,
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
        new behaviors.SceneQueryController(),
        registerDashboardMacro,
        registerPanelInteractionsReporter,
        new behaviors.LiveNowTimer({ enabled: dashboard.liveNow }),
        preserveDashboardSceneStateInLocalStorage,
        addPanelsOnLoadBehavior,
        new DashboardReloadBehavior({
          reloadOnParamsChange: config.featureToggles.reloadDashboardsOnParamsChange && false,
          uid: dashboardId?.toString(),
          version: 1,
        }),
      ],
      $data: new DashboardDataLayerSet({
        annotationLayers,
      }),
      controls: new DashboardControls({
        timePicker: new SceneTimePicker({
          quickRanges: dashboard.timeSettings.quickRanges,
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

  dashboardScene.setInitialSaveModel(dto.spec, dto.metadata);

  return dashboardScene;
}

function getVariables(dashboard: DashboardV2Spec, isSnapshot: boolean): SceneVariableSet | undefined {
  let variables: SceneVariableSet | undefined;

  if (dashboard.variables.length) {
    if (isSnapshot) {
      variables = createVariablesForSnapshot(dashboard);
    } else {
      variables = createVariablesForDashboard(dashboard);
    }
  } else {
    // Create empty variable set
    variables = new SceneVariableSet({
      variables: [],
    });
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

  return new SceneVariableSet({
    variables: variableObjects,
  });
}

function createSceneVariableFromVariableModel(variable: TypedVariableModelV2): SceneVariable {
  const commonProperties = {
    name: variable.spec.name,
    label: variable.spec.label,
    description: variable.spec.description,
  };
  if (variable.kind === defaultAdhocVariableKind().kind) {
    return new AdHocFiltersVariable({
      ...commonProperties,
      description: variable.spec.description,
      skipUrlSync: variable.spec.skipUrlSync,
      hide: transformVariableHideToEnumV1(variable.spec.hide),
      datasource: variable.spec.datasource,
      applyMode: 'auto',
      filters: variable.spec.filters ?? [],
      baseFilters: variable.spec.baseFilters ?? [],
      defaultKeys: variable.spec.defaultKeys,
      useQueriesAsFilterForOptions: true,
      layout: config.featureToggles.newFiltersUI ? 'combobox' : undefined,
      supportsMultiValueOperators: Boolean(
        getDataSourceSrv().getInstanceSettings(variable.spec.datasource)?.meta.multiValueFilterOperators
      ),
    });
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
      allValue: variable.spec.allValue || undefined,
      includeAll: variable.spec.includeAll,
      defaultToAll: Boolean(variable.spec.includeAll),
      isMulti: variable.spec.multi,
      skipUrlSync: variable.spec.skipUrlSync,
      hide: transformVariableHideToEnumV1(variable.spec.hide),
      definition: variable.spec.definition,
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
    });
  } else if (variable.kind === defaultIntervalVariableKind().kind) {
    const intervals = getIntervalsFromQueryString(variable.spec.query);
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
    return new GroupByVariable({
      ...commonProperties,
      datasource: variable.spec.datasource,
      value: variable.spec.current?.value || [],
      text: variable.spec.current?.text || [],
      skipUrlSync: variable.spec.skipUrlSync,
      isMulti: variable.spec.multi,
      hide: transformVariableHideToEnumV1(variable.spec.hide),
      // @ts-expect-error
      defaultOptions: variable.options,
    });
  } else {
    throw new Error(`Scenes: Unsupported variable type ${variable.kind}`);
  }
}

function getDataQueryForVariable(variable: QueryVariableKind) {
  return LEGACY_STRING_VALUE_KEY in variable.spec.query.spec
    ? (variable.spec.query.spec[LEGACY_STRING_VALUE_KEY] ?? '')
    : {
        ...variable.spec.query.spec,
        refId: variable.spec.query.spec.refId ?? 'A',
      };
}

export function getCurrentValueForOldIntervalModel(variable: IntervalVariableKind, intervals: string[]): string {
  const selectedInterval = Array.isArray(variable.spec.current.value)
    ? variable.spec.current.value[0]
    : variable.spec.current.value;

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
          return new AdHocFiltersVariable({
            name: v.spec.name,
            label: v.spec.label,
            readOnly: true,
            description: v.spec.description,
            skipUrlSync: v.spec.skipUrlSync,
            hide: transformVariableHideToEnumV1(v.spec.hide),
            datasource: v.spec.datasource,
            applyMode: 'auto',
            filters: v.spec.filters ?? [],
            baseFilters: v.spec.baseFilters ?? [],
            defaultKeys: v.spec.defaultKeys,
            useQueriesAsFilterForOptions: true,
            layout: config.featureToggles.newFiltersUI ? 'combobox' : undefined,
            supportsMultiValueOperators: Boolean(
              getDataSourceSrv().getInstanceSettings(v.spec.datasource)?.meta.multiValueFilterOperators
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
function getGrafanaBuiltInAnnotationDataLayer(dashboard: DashboardV2Spec) {
  const found = dashboard.annotations.some((item) => item.spec.builtIn);
  if (found) {
    return;
  }

  const grafanaBuiltAnnotation: AnnotationQueryKind = {
    kind: 'AnnotationQuery',
    spec: {
      datasource: { uid: '-- Grafana --', type: 'grafana' },
      name: 'Annotations & Alerts',
      iconColor: DEFAULT_ANNOTATION_COLOR,
      enable: true,
      hide: true,
      builtIn: true,
    },
  };

  return grafanaBuiltAnnotation;
}
