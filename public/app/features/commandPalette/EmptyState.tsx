import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack, Text, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

export interface Props {}

export const EmptyState = ({}: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <Stack direction="column" alignItems="center">
        <img src={'public/img/grot-not-found.svg'} width="200px" alt="grot" />
        <Text variant="h5">
          <Trans i18nKey="command-palette.empty-state.title">No results found</Trans>
        </Text>
      </Stack>
    </div>
  );
};

EmptyState.displayName = 'EmptyState';

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    padding: theme.spacing(8, 0),
  }),
});
