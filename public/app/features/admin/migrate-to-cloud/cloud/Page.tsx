import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Grid, useStyles2 } from '@grafana/ui';

import { InfoPane } from './InfoPane';
import { MigrationTokenPane } from './MigrationTokenPane';

export const Page = () => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <Grid
        alignItems="flex-start"
        gap={1}
        columns={{
          xs: 1,
          lg: 2,
        }}
      >
        <InfoPane />
        <MigrationTokenPane />
      </Grid>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    maxWidth: theme.breakpoints.values.xl,
  }),
});
