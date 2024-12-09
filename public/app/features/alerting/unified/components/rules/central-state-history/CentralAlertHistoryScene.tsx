import { css } from '@emotion/css';
import { useEffect, useMemo } from 'react';
import { Options } from 'uplot';

import { FieldConfig, GrafanaTheme2, VariableHide } from '@grafana/data';
import {
  CustomVariable,
  EmbeddedScene,
  PanelBuilders,
  SceneComponentProps,
  SceneControlsSpacer,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  SceneReactObject,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariableSet,
  TextBoxVariable,
  VariableDependencyConfig,
  VariableValue,
  VariableValueSelectors,
  VizPanel,
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
import { DataSourceInformation } from '../../../home/Insights';

import { alertStateHistoryDatasource, useRegisterHistoryRuntimeDataSource } from './CentralHistoryRuntimeDataSource';
import { HistoryEventsListObject, HistoryEventsListObjectState } from './EventListSceneObject';

export const LABELS_FILTER = 'labelsFilter';
export const STATE_FILTER_TO = 'stateFilterTo';
export const STATE_FILTER_FROM = 'stateFilterFrom';
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
        new ClearFilterButtonScenesObject({
          valueInLabelFilter: labelsFilterVariable.getValue(),
          valueInStateToFilter: transitionsToFilterVariable.getValue(),
          valueInStateFromFilter: transitionsFromFilterVariable.getValue(),
        }),
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
            body: getEventsSceneObject(
              alertStateHistoryDatasource,
              labelsFilterVariable,
              transitionsToFilterVariable,
              transitionsFromFilterVariable
            ),
          }),
          new SceneFlexItem({
            body: new HistoryEventsListObject({
              valueInLabelFilter: labelsFilterVariable.getValue(),
              valueInStateToFilter: transitionsToFilterVariable.getValue(),
              valueInStateFromFilter: transitionsFromFilterVariable.getValue(),
            }),
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
 * @param alertStateHistoryDataSource the datasource information for the runtime datasource
 */
function getEventsSceneObject(
  alertStateHistoryDataSource: DataSourceInformation,
  labelsFilterVariable: TextBoxVariable,
  transitionsToFilterVariable: CustomVariable,
  transitionsFromFilterVariable: CustomVariable
) {
  return new EmbeddedScene({
    controls: [],
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          ySizing: 'content',
          body: new SceneFlexLayout({
            children: [
              getEventsScenesFlexItem(
                alertStateHistoryDataSource,
                labelsFilterVariable,
                transitionsToFilterVariable,
                transitionsFromFilterVariable
              ),
            ],
          }),
        }),
      ],
    }),
  });
}

/**
 * Creates a SceneQueryRunner with the datasource information for the runtime datasource.
 * @param datasource the datasource information for the runtime datasource
 * @returns the SceneQueryRunner
 */
function getSceneQuery(datasource: DataSourceInformation) {
  const query = new SceneQueryRunner({
    datasource: datasource,
    queries: [
      {
        refId: 'A',
        expr: '',
        queryType: 'range',
        step: '10s',
      },
    ],
  });
  return query;
}
/**
 * This function creates a SceneFlexItem with a timeseries panel that shows the events.
 * The query uses a runtime datasource that fetches the events from the history api.
 */
export function getEventsScenesFlexItem(
  datasource: DataSourceInformation,
  labelsFilterVariable: TextBoxVariable,
  transitionsToFilterVariable: CustomVariable,
  transitionsFromFilterVariable: CustomVariable
) {
  return new SceneFlexItem({
    minHeight: 300,
    body: new EventsPanelScenesObject({
      datasource: datasource,
      valueInLabelFilter: labelsFilterVariable.getValue(),
      valueInStateToFilter: transitionsToFilterVariable.getValue(),
      valueInStateFromFilter: transitionsFromFilterVariable.getValue(),
      body:
        // eslint-disable-next-line
        PanelBuilders.timeseries()
          .setTitle('Alert Events')
          .setDescription(
            'Each alert event represents an alert instance that changed its state at a particular point in time. The history of the data is displayed over a period of time.'
          )
          .setData(getSceneQuery(datasource))
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
          .build() as VizPanel<Options, FieldConfig>,
    }),
  });
}

export class EventsPanelScenesObject extends SceneObjectBase<
  FilterScenesObjectState & { datasource: DataSourceInformation; body: VizPanel<Options, FieldConfig> }
> {
  public static Component = EventsPanelScenesObjectRenderer;
  private _onAnyVariableChanged(): void {
    this.forceRender();
  }

  public _onActivate() {
    const stateToFilterVariable = sceneGraph.lookupVariable(STATE_FILTER_TO, this);
    if (stateToFilterVariable instanceof CustomVariable) {
      this.setState({ ...this.state, valueInStateToFilter: stateToFilterVariable.state.value });
      this._subs.add(
        stateToFilterVariable?.subscribeToState((newState, prevState) => {
          this.setState({ ...prevState, valueInStateToFilter: newState.value });
          const query = getSceneQuery(this.state.datasource);
          query.runQueries();
        })
      );
    }
    const stateFromFilterVariable = sceneGraph.lookupVariable(STATE_FILTER_FROM, this);
    if (stateFromFilterVariable instanceof CustomVariable) {
      this.setState({ ...this.state, valueInStateFromFilter: stateFromFilterVariable.state.value });
      this._subs.add(
        stateFromFilterVariable?.subscribeToState((newState, prevState) => {
          this.setState({ ...prevState, valueInStateFromFilter: newState.value });
          const query = getSceneQuery(this.state.datasource);
          query.runQueries();
        })
      );
    }
    const labelsFilterVariable = sceneGraph.lookupVariable(LABELS_FILTER, this);
    if (labelsFilterVariable instanceof TextBoxVariable) {
      this.setState({ ...this.state, valueInLabelFilter: labelsFilterVariable.state.value });
      this._subs.add(
        labelsFilterVariable?.subscribeToState((newState, prevState) => {
          this.setState({ ...prevState, valueInLabelFilter: newState.value });
          const query = getSceneQuery(this.state.datasource);
          query.runQueries();
        })
      );
    }
  }

  public constructor(
    state: HistoryEventsListObjectState & { datasource: DataSourceInformation; body: VizPanel<Options, FieldConfig> }
  ) {
    super(state);
    this.addActivationHandler(this._onActivate.bind(this));
  }
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [LABELS_FILTER, STATE_FILTER_FROM, STATE_FILTER_TO],

    onAnyVariableChanged: this._onAnyVariableChanged.bind(this),
  });
}

export function EventsPanelScenesObjectRenderer({
  model,
}: SceneComponentProps<
  EventsPanelScenesObject & { datasource: DataSourceInformation; body: VizPanel<Options, FieldConfig> }
>) {
  const { body } = model.useState();

  // we need to call this to sync the url with the scene state
  const isUrlSyncInitialized = useUrlSync(model.getRoot());

  if (!isUrlSyncInitialized) {
    return null;
  }

  if (body) {
    return <body.Component model={body} />;
  }
  return <></>;
}

/*
 * This component shows a button to clear the filters.
 * It is shown when the filters are active.
 * props:
 * labelsFilterVariable: the textbox variable for filtering by labels
 * transitionsToFilterVariable: the custom variable for filtering by the current state
 * transitionsFromFilterVariable: the custom variable for filtering by the previous state
 */
export interface FilterScenesObjectState extends SceneObjectState {
  valueInLabelFilter: VariableValue;
  valueInStateToFilter: VariableValue;
  valueInStateFromFilter: VariableValue;
}

export class ClearFilterButtonScenesObject extends SceneObjectBase<FilterScenesObjectState> {
  public static Component = ClearFilterButtonObjectRenderer;

  public _onActivate() {
    const stateToFilterVariable = sceneGraph.lookupVariable(STATE_FILTER_TO, this);
    if (stateToFilterVariable instanceof CustomVariable) {
      this.setState({ ...this.state, valueInStateToFilter: stateToFilterVariable.state.value });
      this._subs.add(
        stateToFilterVariable?.subscribeToState((newState, prevState) => {
          this.setState({ ...prevState, valueInStateToFilter: newState.value });
        })
      );
    }
    const stateFromFilterVariable = sceneGraph.lookupVariable(STATE_FILTER_FROM, this);
    if (stateFromFilterVariable instanceof CustomVariable) {
      this.setState({ ...this.state, valueInStateFromFilter: stateFromFilterVariable.state.value });
      this._subs.add(
        stateFromFilterVariable?.subscribeToState((newState, prevState) => {
          this.setState({ ...prevState, valueInStateFromFilter: newState.value });
        })
      );
    }
    const labelsFilterVariable = sceneGraph.lookupVariable(LABELS_FILTER, this);
    if (labelsFilterVariable instanceof TextBoxVariable) {
      this.setState({ ...this.state, valueInLabelFilter: labelsFilterVariable.state.value });
      this._subs.add(
        labelsFilterVariable?.subscribeToState((newState, prevState) => {
          this.setState({ ...prevState, valueInLabelFilter: newState.value });
        })
      );
    }
  }

  public constructor(state: HistoryEventsListObjectState) {
    super(state);
    this.addActivationHandler(this._onActivate.bind(this));
  }
}

export function ClearFilterButtonObjectRenderer({ model }: SceneComponentProps<ClearFilterButtonScenesObject>) {
  // eslint-disable-next-line
  const labelsFiltersVariable = sceneGraph.lookupVariable(LABELS_FILTER, model)! as TextBoxVariable;
  // eslint-disable-next-line
  const stateToFilterVariable = sceneGraph.lookupVariable(STATE_FILTER_TO, model)! as CustomVariable;
  // eslint-disable-next-line
  const stateFromFilterVariable = sceneGraph.lookupVariable(STATE_FILTER_FROM, model)! as CustomVariable;

  const labelsFiltersVariableState = model.useState().valueInLabelFilter;
  const stateToFilterVariableState = model.useState().valueInStateToFilter;
  const stateFromFilterVariableState = model.useState().valueInStateFromFilter;

  const valueInfilterTextBox = labelsFiltersVariableState;
  const valueInStateToFilter = stateToFilterVariableState;
  const valueInStateFromFilter = stateFromFilterVariableState;

  // if no filter is active, return null
  if (
    !valueInfilterTextBox &&
    valueInStateToFilter === StateFilterValues.all &&
    valueInStateFromFilter === StateFilterValues.all
  ) {
    return null;
  }
  const onClearFilter = () => {
    labelsFiltersVariable.setValue('');
    stateToFilterVariable.changeValueTo(StateFilterValues.all);
    stateFromFilterVariable.changeValueTo(StateFilterValues.all);
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
