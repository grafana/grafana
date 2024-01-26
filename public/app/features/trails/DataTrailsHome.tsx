import { css } from '@emotion/css';
import React, { useState } from 'react';
import { Redirect } from 'react-router-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, sceneGraph, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Button, useStyles2, Stack } from '@grafana/ui';
import { Text } from '@grafana/ui/src/components/Text/Text';

import { DataTrail } from './DataTrail';
import { DataTrailCard } from './DataTrailCard';
import { DataTrailsApp } from './DataTrailsApp';
import { getTrailStore } from './TrailStore/TrailStore';
import { getDatasourceForNewTrail, getUrlForTrail, newMetricsTrail } from './utils';

export interface DataTrailsHomeState extends SceneObjectState {}

export class DataTrailsHome extends SceneObjectBase<DataTrailsHomeState> {
  public constructor(state: DataTrailsHomeState) {
    super(state);
  }

  public onNewMetricsTrail = () => {
    const app = getAppFor(this);
    const trail = newMetricsTrail(getDatasourceForNewTrail());

    getTrailStore().setRecentTrail(trail);
    app.goToUrlForTrail(trail);
  };

  public onSelectTrail = (trail: DataTrail) => {
    const app = getAppFor(this);

    getTrailStore().setRecentTrail(trail);
    app.goToUrlForTrail(trail);
  };

  static Component = ({ model }: SceneComponentProps<DataTrailsHome>) => {
    const [_, setLastDelete] = useState(Date.now());
    const styles = useStyles2(getStyles);

    const onDelete = (index: number) => {
      getTrailStore().removeBookmark(index);
      setLastDelete(Date.now()); // trigger re-render
    };

    // If there are no recent trails, don't show home page and create a new trail
    if (!getTrailStore().recent.length) {
      const trail = newMetricsTrail(getDatasourceForNewTrail());
      getTrailStore().setRecentTrail(trail);
      return <Redirect to={getUrlForTrail(trail)} />;
    }

    return (
      <div className={styles.container}>
        <Stack direction="column" gap={1}>
          <Text variant="h2">Data trails</Text>
          <Text color="secondary">Automatically query, explore and navigate your observability data</Text>
        </Stack>
        <Stack gap={2}>
          <Button icon="plus" size="lg" variant="secondary" onClick={model.onNewMetricsTrail}>
            New metric trail
          </Button>
        </Stack>
        <Stack gap={4}>
          <div className={styles.column}>
            <Text variant="h4">Recent trails</Text>
            <div className={styles.trailList}>
              {getTrailStore().recent.map((trail, index) => {
                const resolvedTrail = trail.resolve();
                return (
                  <DataTrailCard
                    key={(resolvedTrail.state.key || '') + index}
                    trail={resolvedTrail}
                    onSelect={model.onSelectTrail}
                  />
                );
              })}
            </div>
          </div>
          <div className={styles.column}>
            <Text variant="h4">Bookmarks</Text>
            <div className={styles.trailList}>
              {getTrailStore().bookmarks.map((trail, index) => {
                const resolvedTrail = trail.resolve();
                return (
                  <DataTrailCard
                    key={(resolvedTrail.state.key || '') + index}
                    trail={resolvedTrail}
                    onSelect={model.onSelectTrail}
                    onDelete={() => onDelete(index)}
                  />
                );
              })}
            </div>
          </div>
        </Stack>
      </div>
    );
  };
}

function getAppFor(model: SceneObject) {
  return sceneGraph.getAncestor(model, DataTrailsApp);
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      padding: theme.spacing(2),
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(3),
    }),
    column: css({
      width: 500,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
    newTrail: css({
      height: 'auto',
      justifyContent: 'center',
      fontSize: theme.typography.h5.fontSize,
    }),
    trailCard: css({}),
    trailList: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
  };
}
