import { DashboardCursorSync } from '@grafana/data';
import {
  AdHocFiltersVariable,
  SceneControlsSpacer,
  SceneFlexLayout,
  SceneReactObject,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariableSet,
  VariableValueSelectors,
  behaviors,
} from '@grafana/scenes';
import { EmbeddedSceneWithContext } from '@grafana/scenes-react';
import { useTheme2 } from '@grafana/ui';

import { TriageSavedSearchesControl } from './TriageSavedSearchesControl';
import { WorkbenchSceneObject } from './Workbench';
import { prometheusExpressionBuilder } from './expressionBuilder';
import { getAdHocTagKeysProvider, getAdHocTagValuesProvider, getGroupByTagKeysProvider } from './tagKeysProviders';
import { defaultTimeRange } from './utils';

const cursorSync = new behaviors.CursorSync({ key: 'triage-cursor-sync', sync: DashboardCursorSync.Crosshair });

function TimePickerSpacer() {
  const theme = useTheme2();
  return <div style={{ width: theme.spacing(20) }} />;
}

export const triageScene = new EmbeddedSceneWithContext({
  // this will allow us to share the cursor between all vizualizations
  $behaviors: [cursorSync],
  controls: [
    new VariableValueSelectors({}),
    new TriageSavedSearchesControl({}),
    new SceneControlsSpacer(),
    // Keep a fixed spacer before the time picker to align with row content.
    new SceneReactObject({ component: TimePickerSpacer }),
    new SceneTimePicker({}),
    new SceneRefreshPicker({}),
  ],
  $timeRange: new SceneTimeRange(defaultTimeRange),
  $variables: new SceneVariableSet({
    variables: [
      new AdHocFiltersVariable({
        name: 'filters',
        label: 'Filters',
        // Deliberately unset. Scenes merges every ad-hoc filters variable it finds in a query runner's
        // ancestry into `DataQueryRequest.filters` whenever the datasource UIDs match, ignoring applyMode,
        // and Prometheus then appends those matchers to the query expression. That leaked these filters
        // into the alert rule queries rendered by the instance details drawer, and double-applied them to
        // the queries below. Nothing needs the ref: the tag providers resolve the datasource themselves.
        datasource: null,
        applyMode: 'manual', // we will construct the label matchers for the PromQL queries ourselves
        allowCustomValue: true,
        useQueriesAsFilterForOptions: true,
        supportsMultiValueOperators: true,
        enableGroupBy: true,
        groupByInputPlaceholder: 'Group by',
        filters: [],
        baseFilters: [],
        expressionBuilder: prometheusExpressionBuilder,
        getTagKeysProvider: getAdHocTagKeysProvider,
        getTagValuesProvider: getAdHocTagValuesProvider,
        getGroupByKeysProvider: getGroupByTagKeysProvider,
      }),
    ],
  }),
  body: new SceneFlexLayout({
    direction: 'column',
    children: [new WorkbenchSceneObject({})],
  }),
});

export const TriageScene = () => <triageScene.Component model={triageScene} />;
