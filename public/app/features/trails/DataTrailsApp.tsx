import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { DataTrail } from './DataTrail';

export interface DataTrailsAppState extends SceneObjectState {
  trail?: DataTrail;
}

export class DataTrailsApp extends SceneObjectBase<DataTrailsAppState> {
  public constructor(state: Partial<DataTrailsAppState>) {
    super(state);
  }

  static Component = ({ model }: SceneComponentProps<DataTrailsApp>) => {
    const { trail } = model.useState();
    const styles = useStyles2(getStyles);

    if (!trail) {
      return null;
    }

    return (
      <Page navId="data-trails" pageNav={{ text: 'New trail' }} layout={PageLayoutType.Custom}>
        <div className={styles.customPage}>{trail && <trail.Component model={trail} />}</div>
      </Page>
    );
  };
}

export const dataTrailsApp = new DataTrailsApp({
  trail: new DataTrail({ embedded: false }),
});

function getStyles(theme: GrafanaTheme2) {
  return {
    customPage: css({
      padding: theme.spacing(1, 3),
      background: theme.colors.background.primary,
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
    }),
  };
}
