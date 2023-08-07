import { css } from '@emotion/css';
import React from 'react';
import { Observable, map } from 'rxjs';

import { CustomTransformOperator, DataFrame, GrafanaTheme2 } from '@grafana/data';
import {
  EmbeddedScene,
  PanelBuilders,
  SceneDataTransformer,
  SceneFlexItem,
  SceneFlexLayout,
  SceneQueryRunner,
  SceneTimeRange,
} from '@grafana/scenes';
import { Icon, Link, useStyles2 } from '@grafana/ui';

import { createUrl } from './utils/url';

const TOP_5_FIRING_INSTANCES =
  'topk(5, sum by(labels_alertname, ruleUID) (count_over_time({from="state-history"} | json | current = `Alerting` [1w])))';
const TOP_5_FIRING_RULES =
  'topk(5, sum by(group, labels_grafana_folder) (count_over_time({from="state-history"} | json | current = `Alerting` [1w])))';

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

  const ruleLinkTransformation: CustomTransformOperator = () => (source: Observable<DataFrame[]>) => {
    return source.pipe(
      map((data: DataFrame[]) => {
        return data.map((frame: DataFrame) => {
          return {
            ...frame,
            fields: frame.fields.map((field) => {
              if (field.name === 'ruleUID') {
                return {
                  ...field,
                  values: field.values.map((v) => (
                    <Link key={v} target="_blank" href={createUrl(`/alerting/grafana/${v}/view`)}>
                      <Icon name="external-link-alt" />
                    </Link>
                  )),
                };
              }
              return field;
            }),
          };
        });
      })
    );
  };

  const topFiringInstancestransformedData = new SceneDataTransformer({
    $data: topFiringInstancesQuery,
    transformations: [
      ruleLinkTransformation,
      {
        id: 'sortBy',
        options: {
          fields: {},
          sort: [
            {
              field: 'Value #A',
              desc: true,
            },
          ],
        },
      },
      {
        id: 'organize',
        options: {
          excludeByName: {
            Time: true,
          },
          indexByName: {
            labels_alertname: 0,
            'Value #A': 1,
            ruleUID: 2,
          },
          renameByName: {
            labels_alertname: 'Alert Name',
            'Value #A': 'Fires this week',
            ruleUID: 'Link',
          },
        },
      },
    ],
  });

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
            .setData(topFiringInstancestransformedData)

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
