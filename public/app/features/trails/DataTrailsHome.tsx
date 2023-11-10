import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  SceneComponentProps,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
} from '@grafana/scenes';
import { Button, useStyles2, Stack } from '@grafana/ui';
import { Text } from '@grafana/ui/src/components/Text/Text';

import { DataTrail } from './DataTrail';
import { DataTrailCard } from './DataTrailCard';
import { DataTrailsApp } from './DataTrailsApp';
import { newMetricsTrail } from './utils';

export interface DataTrailsHomeState extends SceneObjectState {
  recent: Array<SceneObjectRef<DataTrail>>;
  bookmarks: Array<SceneObjectRef<DataTrail>>;
}

export class DataTrailsHome extends SceneObjectBase<DataTrailsHomeState> {
  public constructor(state: DataTrailsHomeState) {
    super(state);
  }

  public onNewMetricsTrail = () => {
    const app = getAppFor(this);
    const trail = newMetricsTrail();

    this.setState({ recent: [app.state.trail.getRef(), ...this.state.recent] });
    app.goToUrlForTrail(trail);
  };

  public onSelectTrail = (trail: DataTrail) => {
    const app = getAppFor(this);

    const currentTrail = app.state.trail;
    const existsInRecent = this.state.recent.find((t) => t.resolve() === currentTrail);

    if (!existsInRecent) {
      this.setState({ recent: [currentTrail.getRef(), ...this.state.recent] });
    }

    app.goToUrlForTrail(trail);
  };

  static Component = ({ model }: SceneComponentProps<DataTrailsHome>) => {
    const { recent, bookmarks } = model.useState();
    const app = getAppFor(model);
    const styles = useStyles2(getStyles);

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
              {app.state.trail.state.metric && <DataTrailCard trail={app.state.trail} onSelect={model.onSelectTrail} />}
              {recent.map((trail, index) => (
                <DataTrailCard key={index} trail={trail.resolve()} onSelect={model.onSelectTrail} />
              ))}
            </div>
          </div>
          <div className={styles.column}>
            <Text variant="h4">Bookmarks</Text>
            <div className={styles.trailList}>
              {bookmarks.map((trail, index) => (
                <DataTrailCard key={index} trail={trail.resolve()} onSelect={model.onSelectTrail} />
              ))}
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
