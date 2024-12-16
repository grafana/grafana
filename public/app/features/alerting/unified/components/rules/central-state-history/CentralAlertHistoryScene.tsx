import { css } from '@emotion/css';
import { useEffect, useMemo } from 'react';

import { GrafanaTheme2, VariableHide } from '@grafana/data';
import {
  CustomVariable,
  EmbeddedScene,
  PanelBuilders,
  SceneComponentProps,
  SceneControlsSpacer,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObjectBase,
  SceneQueryRunner,
  SceneReactObject,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariableSet,
  TextBoxVariable,
  VariableDependencyConfig,
  VariableValueSelectors,
  sceneGraph,
  useUrlSync,
} from '@grafana/scenes';
import { GraphDrawStyle, VisibilityMode } from '@grafana/schema/dist/esm/index';
import {
  Button,
  GraphGradientMode,
  Icon,
  LegendDisplayMode,
  LineInterpolation,
  ScaleDistribution,
  StackingMode,
  Text,
  Tooltip,
  TooltipDisplayMode,
  useStyles2,
} from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { LogMessages, logInfo } from '../../../Analytics';

import { alertStateHistoryDatasource, useRegisterHistoryRuntimeDataSource } from './CentralHistoryRuntimeDataSource';
import { HistoryEventsListObject } from './EventListSceneObject';

export const LABELS_FILTER = 'LABELS_FILTER';
export const STATE_FILTER_TO = 'STATE_FILTER_TO';
export const STATE_FILTER_FROM = 'STATE_FILTER_FROM';
/**
 *
 * This scene shows the history of the alert state changes.
 * It shows a timeseries panel with the alert state changes and a list of the events.
 * The events in the panel are fetched from the history api, through a runtime datasource.
 * The events in the list are fetched direclty from the history api.
 * Main scene renders two children scene objects, one for the timeseries panel and one for the list of events.
 * Both share time range and filter variable from the parent scene.
 */

export const StateFilterValues = {
  all: 'all',
  firing: 'Alerting',
  normal: 'Normal',
  pending: 'Pending',
} as const;

export const CentralAlertHistoryScene = () => {
  //track the loading of the central alert state history
  useEffect(() => {
    logInfo(LogMessages.loadedCentralAlertStateHistory);
  }, []);

  useRegisterHistoryRuntimeDataSource(); // register the runtime datasource for the history api.

  const scene = useMemo(() => {
    // create the variables for the filters
    // textbox variable for filtering by labels
    const labelsFilterVariable = new TextBoxVariable({
      name: LABELS_FILTER,
      label: 'Labels: ',
    });

    //custom variable for filtering by the current state
    const transitionsToFilterVariable = new CustomVariable({
      name: STATE_FILTER_TO,
      value: StateFilterValues.all,
      label: 'End state:',
      hide: VariableHide.dontHide,
      query: `All : ${StateFilterValues.all}, To Firing : ${StateFilterValues.firing},To Normal : ${StateFilterValues.normal},To Pending : ${StateFilterValues.pending}`,
    });

    //custom variable for filtering by the previous state
    const transitionsFromFilterVariable = new CustomVariable({
      name: STATE_FILTER_FROM,
      value: StateFilterValues.all,
      label: 'Start state:',
      hide: VariableHide.dontHide,
      query: `All : ${StateFilterValues.all}, From Firing : ${StateFilterValues.firing},From Normal : ${StateFilterValues.normal},From Pending : ${StateFilterValues.pending}`,
    });

    return new EmbeddedScene({
      controls: [
        new SceneReactObject({
          component: LabelFilter,
        }),
        new SceneReactObject({
          component: FilterInfo,
        }),
        new VariableValueSelectors({}),
        new ClearFilterButtonScenesObject({}),
        new SceneControlsSpacer(),
        new SceneTimePicker({}),
        new SceneRefreshPicker({}),
      ],
      // use default time range as from 1 hour ago to now, as the limit of the history api is 5000 events,
      // and using a wider time range might lead to showing gaps in the events list and the chart.
      $timeRange: new SceneTimeRange({
        from: 'now-1h',
        to: 'now',
      }),
      $variables: new SceneVariableSet({
        variables: [labelsFilterVariable, transitionsFromFilterVariable, transitionsToFilterVariable],
      }),
      body: new SceneFlexLayout({
        direction: 'column',
        children: [
          new SceneFlexItem({
            ySizing: 'content',
            body: getEventsSceneObject(),
          }),
          new SceneFlexItem({
            body: new HistoryEventsListObject({}),
          }),
        ],
      }),
    });
  }, []);

  // we need to call this to sync the url with the scene state
  const isUrlSyncInitialized = useUrlSync(scene);

  if (!isUrlSyncInitialized) {
    return null;
  }

  return <scene.Component model={scene} />;
};
/**
 * Creates a SceneFlexItem with a timeseries panel that shows the events.
 * The query uses a runtime datasource that fetches the events from the history api.
 */
function getEventsSceneObject() {
  return new SceneFlexLayout({
    direction: 'column',
    children: [getEventsScenesFlexItem()],
  });
}

/**
 * Creates a SceneQueryRunner with the datasource information for the runtime datasource.
 * @param datasource the datasource information for the runtime datasource
 * @returns the SceneQueryRunner
 */
function getQueryRunnerForAlertHistoryDataSource() {
  const query = new SceneQueryRunner({
    datasource: alertStateHistoryDatasource,
    queries: [
      {
        refId: 'A',
        labels: '${LABELS_FILTER}',
        stateFrom: '${STATE_FILTER_FROM}',
        stateTo: '${STATE_FILTER_TO}',
      },
    ],
  });
  return query;
}
/**
 * This function creates a SceneFlexItem with a timeseries panel that shows the events.
 * The query uses a runtime datasource that fetches the events from the history api.
 */
export function getEventsScenesFlexItem() {
  return new SceneFlexItem({
    minHeight: 300,
    body: PanelBuilders.timeseries()
      .setTitle('Alert Events')
      .setDescription(
        'Each alert event represents an alert instance that changed its state at a particular point in time. The history of the data is displayed over a period of time.'
      )
      .setData(getQueryRunnerForAlertHistoryDataSource())
      .setColor({ mode: 'continuous-BlPu' })
      .setCustomFieldConfig('fillOpacity', 100)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Bars)
      .setCustomFieldConfig('lineInterpolation', LineInterpolation.Linear)
      .setCustomFieldConfig('lineWidth', 1)
      .setCustomFieldConfig('barAlignment', 0)
      .setCustomFieldConfig('spanNulls', false)
      .setCustomFieldConfig('insertNulls', false)
      .setCustomFieldConfig('showPoints', VisibilityMode.Auto)
      .setCustomFieldConfig('pointSize', 5)
      .setCustomFieldConfig('stacking', { mode: StackingMode.None, group: 'A' })
      .setCustomFieldConfig('gradientMode', GraphGradientMode.Hue)
      .setCustomFieldConfig('scaleDistribution', { type: ScaleDistribution.Linear })
      .setOption('legend', { showLegend: false, displayMode: LegendDisplayMode.Hidden })
      .setOption('tooltip', { mode: TooltipDisplayMode.Single })
      .setNoValue('No events found')
      .build(),
  });
}

export class ClearFilterButtonScenesObject extends SceneObjectBase {
  public static Component = ClearFilterButtonObjectRenderer;

  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [LABELS_FILTER, STATE_FILTER_FROM, STATE_FILTER_TO],
  });
}

export function ClearFilterButtonObjectRenderer({ model }: SceneComponentProps<ClearFilterButtonScenesObject>) {
  // This make sure the component is re-rendered when the variables change
  model.useState();

  const labelsFilter = sceneGraph.interpolate(model, '${LABELS_FILTER}');
  const stateTo = sceneGraph.interpolate(model, '${STATE_FILTER_TO}');
  const stateFrom = sceneGraph.interpolate(model, '${STATE_FILTER_FROM}');

  // if no filter is active, return null
  if (!labelsFilter && stateTo === StateFilterValues.all && stateFrom === StateFilterValues.all) {
    return null;
  }

  const onClearFilter = () => {
    const labelsFiltersVariable = sceneGraph.lookupVariable(LABELS_FILTER, model);
    if (labelsFiltersVariable instanceof TextBoxVariable) {
      labelsFiltersVariable.setValue('');
    }

    const stateToFilterVariable = sceneGraph.lookupVariable(STATE_FILTER_TO, model);
    if (stateToFilterVariable instanceof CustomVariable) {
      stateToFilterVariable.changeValueTo(StateFilterValues.all);
    }

    const stateFromFilterVariable = sceneGraph.lookupVariable(STATE_FILTER_FROM, model);
    if (stateFromFilterVariable instanceof CustomVariable) {
      stateFromFilterVariable.changeValueTo(StateFilterValues.all);
    }
  };

  return (
    <Tooltip content="Clear filter">
      <Button variant={'secondary'} icon="times" onClick={onClearFilter}>
        <Trans i18nKey="alerting.central-alert-history.filter.clear">Clear filters</Trans>
      </Button>
    </Tooltip>
  );
}

const LabelFilter = () => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.filterLabelContainer}>
      <Text variant="body" weight="light" color="secondary">
        <Trans i18nKey="alerting.central-alert-history.filterBy">Filter by:</Trans>
      </Text>
    </div>
  );
};

const FilterInfo = () => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.filterInfoContainer}>
      <Tooltip
        content={
          <div>
            <Trans i18nKey="alerting.central-alert-history.filter.info.label1">
              Filter events using label querying without spaces, ex:
            </Trans>
            <pre>{`{severity="critical", instance=~"cluster-us-.+"}`}</pre>
            <Trans i18nKey="alerting.central-alert-history.filter.info.label2">Invalid use of spaces:</Trans>
            <pre>{`{severity= "critical"}`}</pre>
            <pre>{`{severity ="critical"}`}</pre>
            <Trans i18nKey="alerting.central-alert-history.filter.info.label3">Valid use of spaces:</Trans>
            <pre>{`{severity=" critical"}`}</pre>
            <Trans i18nKey="alerting.central-alert-history.filter.info.label4">
              Filter alerts using label querying without braces, ex:
            </Trans>
            <pre>{`severity="critical", instance=~"cluster-us-.+"`}</pre>
          </div>
        }
      >
        <Icon name="info-circle" size="sm" />
      </Tooltip>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    filterInfoContainer: css({
      padding: '0',
      alignSelf: 'center',
      marginRight: theme.spacing(-1),
    }),
    filterLabelContainer: css({
      padding: '0',
      alignSelf: 'center',
    }),
  };
};
