import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Stack, Label } from '@grafana/ui';

export function EditorColumnHeader({ label, actions }: { label: string; actions?: React.ReactNode }) {
  const styles = useStyles2(editorColumnStyles);

  return (
    <div className={styles.container}>
      <Label className={styles.label}>{label}</Label>
      <Stack direction="row" gap={1}>
        {actions}
      </Stack>
    </div>
  );
}

export const editorColumnStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing(1, 2),
    backgroundColor: theme.colors.background.secondary,
    borderBottom: `1px solid ${theme.colors.border.medium}`,
  }),
  label: css({
    margin: 0,
  }),
});
