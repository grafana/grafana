import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Grid, Stack, useStyles2 } from '@grafana/ui';

import { CallToAction } from './CallToAction/CallToAction';
import { InfoPaneLeft } from './InfoPaneLeft';
import { InfoPaneRight } from './InfoPaneRight';

export const EmptyState = () => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <Stack direction="column">
        <CallToAction />
        <Grid
          alignItems="flex-start"
          gap={1}
          columns={{
            xs: 1,
            lg: 2,
          }}
        >
          <InfoPaneLeft />
          <InfoPaneRight />
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
