import { DashboardCursorSync } from '@grafana/data';
import {
  AdHocFiltersVariable,
  GroupByVariable,
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
import { useTheme2 } from '@grafana/ui/themes';

import { DATASOURCE_UID } from '../constants';

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
        datasource: {
          type: 'prometheus',
          uid: DATASOURCE_UID,
        },
        applyMode: 'manual', // we will construct the label matchers for the PromQL queries ourselves
        allowCustomValue: true,
        useQueriesAsFilterForOptions: true,
        supportsMultiValueOperators: true,
        filters: [],
        baseFilters: [],
        expressionBuilder: prometheusExpressionBuilder,
        getTagKeysProvider: getAdHocTagKeysProvider,
        getTagValuesProvider: getAdHocTagValuesProvider,
      }),
      new GroupByVariable({
        name: 'groupBy',
        label: 'Group by',
        datasource: {
          type: 'prometheus',
          uid: DATASOURCE_UID,
        },
        allowCustomValue: true,
        applyMode: 'manual',
        getTagKeysProvider: getGroupByTagKeysProvider,
      }),
    ],
  }),
  body: new SceneFlexLayout({
    direction: 'column',
    children: [new WorkbenchSceneObject({})],
  }),
});

export const TriageScene = () => <triageScene.Component model={triageScene} />;
