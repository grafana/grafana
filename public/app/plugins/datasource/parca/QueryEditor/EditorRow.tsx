import { css } from '@emotion/css';
import * as React from 'react';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { useStyles2 } from '@grafana/ui/themes';

import { Stack } from './Stack';

interface EditorRowProps {
  children: React.ReactNode;
  stackProps?: Partial<React.ComponentProps<typeof Stack>>;
}

export const EditorRow = ({ children, stackProps }: EditorRowProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.root}>
      <Stack gap={2} {...stackProps}>
        {children}
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    root: css({
      padding: theme.spacing(1),
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
    }),
  };
};
