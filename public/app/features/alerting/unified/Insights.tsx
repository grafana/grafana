import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { EmbeddedScene, PanelBuilders, SceneFlexItem, SceneFlexLayout, SceneQueryRunner } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

const FIRING_QUERIES_LAST_WEEK = 'sum(count_over_time({from="state-history"} | json | current="Alerting"[1w]))';
const TOTAL_QUERIES_LAST_WEEK = 'sum(count_over_time({from="state-history"} | json [1w]))';

const WORST_OFFENDERS_ALERTS_THIS_WEEK =
  'sum by (labels_grafana_folder, group) (count_over_time({from="state-history"} | json | current="Alerting"[1w]))';

//since all cloud instances have a provisioned alert state history data source,
//we should be able to use its uid here
const datasourceUid = 'CKA1_2hVz';

function getScene() {
  const queryRunner1 = new SceneQueryRunner({
    datasource: {
      type: 'loki',
      uid: datasourceUid,
    },
    queries: [
      {
        refId: 'A',
        expr: FIRING_QUERIES_LAST_WEEK,
      },
    ],
  });

  const queryRunner2 = new SceneQueryRunner({
    datasource: {
      type: 'loki',
      uid: datasourceUid,
    },
    queries: [
      {
        refId: 'A',
        expr: TOTAL_QUERIES_LAST_WEEK,
      },
    ],
  });

  const queryRunner3 = new SceneQueryRunner({
    datasource: {
      type: 'loki',
      uid: 'CKA1_2hVz',
    },
    queries: [
      {
        refId: 'A',
        instant: true,
        expr: WORST_OFFENDERS_ALERTS_THIS_WEEK,
      },
    ],
  });

  return new EmbeddedScene({
    body: new SceneFlexLayout({
      direction: 'row',
      wrap: 'wrap',
      children: [
        new SceneFlexItem({
          height: 300,
          body: PanelBuilders.stat().setTitle('Firing queries last week').setData(queryRunner1).build(),
        }),
        new SceneFlexItem({
          height: 300,
          body: PanelBuilders.stat().setTitle('Total queries last week').setData(queryRunner2).build(),
        }),
        new SceneFlexItem({
          width: '100%',
          height: 300,
          body: PanelBuilders.table()
            .setTitle('Worst Offender Alerts - This Week')
            .setData(queryRunner3)
            .setOverrides((b) =>
              b
                .matchFieldsWithNameByRegex('.*')
                .overrideFilterable(false)
                .matchFieldsWithName('Time')
                .overrideCustomFieldConfig('hidden', true)
                .matchFieldsWithName('Value #A')
                .overrideDisplayName('Fires Last Week')
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
      <p>Information about your alerts</p>
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
