import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { EmbeddedScene, PanelBuilders, SceneFlexItem, SceneFlexLayout, SceneQueryRunner } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

function getScene() {
  const queryRunner1 = new SceneQueryRunner({
    datasource: {
      type: 'loki',
      //since all cloud instances have a provisioned alert state history data source,
      //we should be able to use its uid here
      uid: 'CKA1_2hVz',
    },
    queries: [
      {
        refId: 'A',
        expr: '{from="state-history"} | json | current="Alerting"',
      },
    ],
  });

  const queryRunner2 = new SceneQueryRunner({
    datasource: {
      type: 'prometheus',
      uid: 'gdev-prometheus',
    },
    queries: [
      {
        refId: 'A',
        expr: 'avg by (job, instance, mode) (rate(node_cpu_seconds_total[5m]))',
      },
    ],
  });

  return new EmbeddedScene({
    body: new SceneFlexLayout({
      children: [
        new SceneFlexItem({
          width: '50%',
          height: 300,
          body: PanelBuilders.table()
            .setTitle('Panel using alert state history data source')
            .setData(queryRunner1)
            .build(),
        }),
        new SceneFlexItem({
          width: '50%',
          height: 300,
          body: PanelBuilders.timeseries().setTitle('Panel using prometheus data source').setData(queryRunner2).build(),
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
