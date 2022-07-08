import { css } from '@emotion/css';
import React from 'react';
import { useAsync } from 'react-use';

import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { Card, Icon, useStyles2 } from '@grafana/ui';

import { DashboardModel } from '../dashboard/state';

import { getGrafanaStorage } from './storage';

interface Props {
  dash: DashboardModel;
}

export function FolderDashboard({ dash }: Props) {
  const styles = useStyles2(getStyles);
  const listing = useAsync((): Promise<DataFrame | undefined> => {
    return getGrafanaStorage().list(dash.uid);
  }, [dash.uid]);

  if (listing.value) {
    const names = listing.value.fields[0].values.toArray();
    let base = document.location.pathname;
    if (!base.endsWith('/')) {
      base += '/';
    }

    return (
      <div className={styles.wrapper}>
        {names.map((item) => {
          let name = item;
          if (name.endsWith('.json')) {
            name = name.substring(0, name.length - '.json'.length);
          }

          const url = base + name;
          return (
            <Card key={name} href={url}>
              <Card.Heading>{name}</Card.Heading>
              <Card.Figure>
                <Icon name={name === 'directory' ? 'folder' : 'gf-grid'} size="sm" />
              </Card.Figure>
            </Card>
          );
        })}
      </div>
    );
  }

  return <div>FOLDER: {dash.uid}</div>;
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    margin: 50px;
  `,
});
