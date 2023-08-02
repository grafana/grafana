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

const FIRING_QUERIES_LAST_WEEK = 'sum(count_over_time({from="state-history"} | json | current="Alerting"[1w]))';
const TOTAL_QUERIES_LAST_WEEK = 'sum(count_over_time({from="state-history"} | json[1w]))';

const WORST_OFFENDERS_ALERTS_THIS_WEEK =
  'sum by (labels_grafana_folder, group) (count_over_time({from="state-history"} | json | current="Alerting"[1w]))';

//all cloud instances are guaranteed to have this datasource uid for the alert state history loki datasource
const datasourceUid = 'grafanacloud-alert-state-history';

const datasource = {
  type: 'loki',
  uid: datasourceUid,
};

function getScene() {
  const queryRunner1 = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: TOTAL_QUERIES_LAST_WEEK,
      },
    ],
  });

  const queryRunner2 = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: FIRING_QUERIES_LAST_WEEK,
      },
    ],
    $timeRange: new SceneTimeRange({ from: 'now-2w', to: 'now-1w' }),
  });

  const queryRunner3 = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: FIRING_QUERIES_LAST_WEEK,
      },
    ],
    $timeRange: new SceneTimeRange({ from: 'now-1w', to: 'now' }),
  });

  const queryRunner4 = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        instant: true,
        expr: WORST_OFFENDERS_ALERTS_THIS_WEEK,
      },
    ],
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
  });*/

  return new EmbeddedScene({
    body: new SceneFlexLayout({
      direction: 'row',
      wrap: 'wrap',
      children: [
        new SceneFlexItem({
          width: '100%',
          height: 300,
          body: PanelBuilders.stat().setTitle('Total queries this week').setData(queryRunner1).build(),
        }),
        new SceneFlexItem({
          height: 300,
          body: PanelBuilders.stat().setTitle('Total Firing 2 weeks from now').setData(queryRunner2).build(),
        }),
        new SceneFlexItem({
          height: 300,
          body: PanelBuilders.stat().setTitle('Total Firing last week').setData(queryRunner3).build(),
        }),
        new SceneFlexItem({
          width: '100%',
          height: 300,
          body: PanelBuilders.table()
            .setTitle('Alerts that fired the most this week')
            .setData(queryRunner4)
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
                .matchFieldsWithName('group')
                .overrideDisplayName('Group')
            )
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
