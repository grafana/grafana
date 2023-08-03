import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  EmbeddedScene,
  PanelBuilders,
  SceneFlexItem,
  SceneFlexLayout,
  SceneQueryRunner,
  SceneTimeRange,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

const TOP_5_FIRING_INSTANCES =
  'topk(5, sum by(labels_alertname, ruleUID) (count_over_time({from="state-history"} | json | current = `Alerting` [1w])))';
const TOP_5_FIRING_RULES =
  'topk(5, sum by(ruleUID, labels_grafana_folder) (count_over_time({from="state-history"} | json | current = `Alerting` [1w])))';

const TOTALS_FIRING = 'sum(count_over_time({from="state-history"} | json | current="Alerting"[1w]))';
const TOTALS = 'sum(count_over_time({from="state-history"} | json[1w]))';

const RATE_FIRING = 'sum(count_over_time({from="state-history"} | json | current="Alerting"[1w]))';

const LAST_WEEK_TIME_RANGE = new SceneTimeRange({ from: 'now-1w', to: 'now' });

//all cloud instances are guaranteed to have this datasource uid for the alert state history loki datasource
const datasourceUid = 'grafanacloud-alert-state-history';

const datasource = {
  type: 'loki',
  uid: datasourceUid,
};

function getScene() {
  const topFiringInstancesQuery = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: TOP_5_FIRING_INSTANCES,
        instant: true,
      },
    ],

    $timeRange: LAST_WEEK_TIME_RANGE,
  });

  const topFiringRulesQuery = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: TOP_5_FIRING_RULES,
        instant: true,
      },
    ],
    $timeRange: LAST_WEEK_TIME_RANGE,
  });

  const totalsQuery = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        instant: true,
        expr: TOTALS_FIRING,
      },
      {
        refId: 'B',
        instant: true,
        expr: TOTALS,
      },
    ],
    $timeRange: LAST_WEEK_TIME_RANGE,
  });

  const rateFiringQuery = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: RATE_FIRING,
      },
    ],
    $timeRange: LAST_WEEK_TIME_RANGE,
  });

  //this accepts the same format as the one outputted when inspecting a panel transformation as JSON
  /*const transformedQueryData = new SceneDataTransformer({
    $data: queryRunner1,
    transformations: [
      {
        id: 'calculateField',
        options: {
          title: '%',
          mode: 'reduceRow',
          reduce: {
            reducer: 'allValues',
          },
        },
      },
    ],
  });

  const thresholds: ThresholdsConfig = {
    steps: [
      { value: 0, color: 'RED' },
      { value: 20, color: 'GREEN' },
    ],
    mode: ThresholdsMode.Percentage,
  };*/

  return new EmbeddedScene({
    body: new SceneFlexLayout({
      direction: 'row',
      wrap: 'wrap',
      children: [
        new SceneFlexItem({
          width: '50%',
          height: 300,
          body: PanelBuilders.table()
            .setTitle('Alert rules - fired most over the past week')
            .setData(topFiringRulesQuery)
            .setOverrides((b) =>
              b
                .matchFieldsWithNameByRegex('.*')
                .overrideFilterable(false)
                .matchFieldsWithName('Time')
                .overrideCustomFieldConfig('hidden', true)
                .matchFieldsWithName('Value #A')
                .overrideDisplayName('Fires this week')
                .matchFieldsWithName('labels_alertname')
                .overrideDisplayName('Alert name')
                .matchFieldsWithName('ruleUID')
                .overrideCustomFieldConfig('hidden', false)
            )
            .build(),
        }),
        new SceneFlexItem({
          width: '49%',
          height: 300,
          body: PanelBuilders.table()
            .setTitle('Alert instances - Fired most over the past week')
            .setData(topFiringInstancesQuery)
            .setOverrides((b) =>
              b
                .matchFieldsWithNameByRegex('.*')
                .overrideFilterable(false)
                .matchFieldsWithName('Time')
                .overrideCustomFieldConfig('hidden', true)
                .matchFieldsWithName('Value #A')
                .overrideDisplayName('Fires this week')
                .matchFieldsWithName('labels_grafana_folder')
                .overrideDisplayName('Folder')
                .matchFieldsWithName('ruleUID')
                .overrideCustomFieldConfig('hidden', false)
            )
            .build(),
        }),
        new SceneFlexItem({
          width: '50%',
          height: 300,
          body: PanelBuilders.piechart()
            .setTitle('Firing vs Totals / Last week')
            .setData(totalsQuery)
            .setOverrides((b) =>
              b
                .matchFieldsWithName('Value #A')
                .overrideDisplayName('#Firing')
                .matchFieldsWithName('Value #B')
                .overrideDisplayName('#Total')
            )
            .build(),
        }),
        new SceneFlexItem({
          width: '49%',
          height: 300,
          body: PanelBuilders.timeseries()
            .setTitle('Rate of firing alerts / Last week')
            .setData(rateFiringQuery)
            .setOverrides((b) => b.matchFieldsWithName('{}').overrideDisplayName('#Firing'))
            .build(),
        }),
      ],
    }),
  });
}

export default function GettingStarted() {
  const styles = useStyles2(getStyles);

  const scene = getScene();

  return (
    <div className={styles.container}>
      <div className={styles.panelsContainer}>
        <scene.Component model={scene} />
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    padding: '10px 0 10px 0',
  }),
  panelsContainer: css({
    display: 'flex',
  }),
});
