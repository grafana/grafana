import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import { Text } from '@grafana/ui/src/components/Text/Text';
import { Flex } from '@grafana/ui/src/unstable';

import { DataTrail } from './DataTrail';
import { DataTrailCard } from './DataTrailCard';
import { getTrailsAppFor } from './getUtils';

export interface DataTrailsHomeState extends SceneObjectState {
  recent: DataTrail[];
}

export class DataTrailsHome extends SceneObjectBase<DataTrailsHomeState> {
  public constructor(state: DataTrailsHomeState) {
    super(state);
  }

  public onStartNew = () => {
    const app = getTrailsAppFor(this);

    this.setState({ recent: [...this.state.recent, app.state.trail] });
    app.setState({ trail: new DataTrail({ embedded: false }) });
    locationService.push('/data-trails/trail');
  };

  public onSelectTrail = (trail: DataTrail) => {
    const app = getTrailsAppFor(this);

    const currentTrail = app.state.trail;
    const existsInRecent = this.state.recent.find((t) => t === currentTrail);
    if (!existsInRecent) {
      this.setState({ recent: [...this.state.recent, currentTrail] });
    }

    app.setState({ trail: trail });
    locationService.push('/data-trails/trail');
  };

  static Component = ({ model }: SceneComponentProps<DataTrailsHome>) => {
    const { recent } = model.useState();
    const app = getTrailsAppFor(model);
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.container}>
        <Flex direction="column" gap={1}>
          <Text variant="h2">Data trails</Text>
          <Text color="secondary">Automatically query, explore and navigate your observability data</Text>
        </Flex>
        <div>
          <Button icon="plus" size="lg" variant="secondary" onClick={model.onStartNew}>
            Start new trail
          </Button>
        </div>
        <Flex gap={4}>
          <div className={styles.column}>
            <Text variant="h4">Recent trails</Text>
            <div className={styles.trailList}>
              {app.state.trail.state.metric && <DataTrailCard trail={app.state.trail} onSelect={model.onSelectTrail} />}
              {recent.map((trail, index) => (
                <DataTrailCard key={index} trail={trail} onSelect={model.onSelectTrail} />
              ))}
            </div>
          </div>
          <div>
            <Text variant="h4">Bookmarks</Text>
            <div className={styles.trailList}></div>
          </div>
        </Flex>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      padding: theme.spacing(2),
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
    column: css({
      width: 500,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
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
      // gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      // gridAutoRows: '200px',
      // columnGap: theme.spacing(2),
      // rowGap: theme.spacing(2),
    }),
  };
}
