import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Grid, Stack, useStyles2 } from '@grafana/ui';

import { CallToAction } from './CallToAction';
import { InfoPane1 } from './InfoPane1';
import { InfoPane2 } from './InfoPane2';

export const EmptyState = () => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <Stack direction="column">
        <CallToAction />
        <Grid
          gap={1}
          columns={{
            xs: 1,
            lg: 2,
          }}
        >
          <InfoPane1 />
          <InfoPane2 />
        </Grid>
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    maxWidth: theme.breakpoints.values.xl,
  }),
});
