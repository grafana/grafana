import { css } from '@emotion/css';

import { VariableHide } from '@grafana/data';
import {
  CustomVariable,
  EmbeddedScene,
  PanelBuilders,
  SceneControlsSpacer,
  SceneFlexItem,
  SceneFlexLayout,
  SceneQueryRunner,
  SceneReactObject,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariableSet,
  TextBoxVariable,
  VariableValueSelectors,
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

import { DataSourceInformation } from '../../../home/Insights';

import { alertStateHistoryDatasource, useRegisterHistoryRuntimeDataSource } from './CentralHistoryRuntimeDataSource';
import { HistoryEventsListObject } from './EventListSceneObject';

export const LABELS_FILTER = 'labelsFilter';
export const STATE_FILTER = 'stateFilter';
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
  const labelsFilterVariable = new TextBoxVariable({
    name: LABELS_FILTER,
    label: 'Filter by labels: ',
  });
  const transitionsFilterVariable = new CustomVariable({
    name: STATE_FILTER,
    value: 'all',
    label: 'Filter by state:',
    hide: VariableHide.dontHide,
    query: `All : ${StateFilterValues.all}, To Firing : ${StateFilterValues.firing},To Normal : ${StateFilterValues.normal},To Pending : ${StateFilterValues.pending}`,
  });

  useRegisterHistoryRuntimeDataSource(); // register the runtime datasource for the history api.

  const scene = new EmbeddedScene({
    controls: [
      new SceneReactObject({
        component: FilterInfo,
      }),
      new VariableValueSelectors({}),
      new SceneReactObject({
        component: ClearFilterButton,
        props: {
          labelsFilterVariable: labelsFilterVariable,
          transitionsFilterVariable: transitionsFilterVariable
        },
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
      variables: [labelsFilterVariable, transitionsFilterVariable],
    }),
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          ySizing: 'content',
          body: getEventsSceneObject(alertStateHistoryDatasource),
        }),
        new SceneFlexItem({
          body: new HistoryEventsListObject(),
        }),
      ],
    }),
  });
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
function getEventsSceneObject(alertStateHistoryDataSource: DataSourceInformation) {
  return new EmbeddedScene({
    controls: [],
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          ySizing: 'content',
          body: new SceneFlexLayout({
            children: [getEventsScenesFlexItem(alertStateHistoryDataSource)],
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
export function getEventsScenesFlexItem(datasource: DataSourceInformation) {
  return new SceneFlexItem({
    minHeight: 300,
    body: PanelBuilders.timeseries()
      .setTitle('Events')
      .setDescription('Alert events during the period of time.')
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
      .build(),
  });
}

function ClearFilterButton({ labelsFilterVariable, transitionsFilterVariable }: { labelsFilterVariable: TextBoxVariable, transitionsFilterVariable: CustomVariable }) {
  const styles = useStyles2(getStyles);
  const valueInLabelsFilter = labelsFilterVariable.getValue();
  const valueInTransitionsFilter = transitionsFilterVariable.getValue();
  if (!valueInLabelsFilter && valueInTransitionsFilter === StateFilterValues.all) {
    return null;
  }
  const onClearFilter = () => {
    labelsFilterVariable.setValue('');
    transitionsFilterVariable.changeValueTo(StateFilterValues.all);
  };
  return (
    <Tooltip content="Clear filter">
      <div className={styles.clearFilter}>
        <Button variant={'secondary'} icon="times" onClick={onClearFilter}>
          <Trans i18nKey="central-alert-history.filter.clear">
            <Text>Clear filters</Text>
          </Trans>
        </Button>
      </div>
    </Tooltip>
  );
}

export const FilterInfo = () => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.container}>
      <Tooltip
        content={
          <div>
            <Trans i18nKey="central-alert-history.filter.info.label1">
              Filter events using label querying without spaces, ex:
            </Trans>
            <pre>{`{severity="critical", instance=~"cluster-us-.+"}`}</pre>
            <Trans i18nKey="central-alert-history.filter.info.label2">Invalid use of spaces:</Trans>
            <pre>{`{severity= "critical"}`}</pre>
            <pre>{`{severity ="critical"}`}</pre>
            <Trans i18nKey="central-alert-history.filter.info.label3">Valid use of spaces:</Trans>
            <pre>{`{severity=" critical"}`}</pre>
            <Trans i18nKey="central-alert-history.filter.info.label4">
              Filter events using label querying without braces, ex:
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

const getStyles = () => ({
  container: css({
    padding: '0',
    alignSelf: 'center',
  }),
  clearFilter: css({
    alignSelf: 'center',
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'row',
  }),
});
