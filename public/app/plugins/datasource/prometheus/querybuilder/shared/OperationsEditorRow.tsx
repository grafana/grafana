import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { useStyles2 } from '@grafana/ui';

interface Props {
  children: React.ReactNode;
}

export function OperationsEditorRow({ children }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.root}>
      <Stack gap={1}>{children}</Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    root: css({
      padding: theme.spacing(1, 1, 0, 1),
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.shape.borderRadius(1),
    }),
  };
};
