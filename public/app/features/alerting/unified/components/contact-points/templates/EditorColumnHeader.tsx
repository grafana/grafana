import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Label, Stack, useStyles2 } from '@grafana/ui';

type Props = { label: string; actions?: React.ReactNode; id?: string };

export function EditorColumnHeader({ label, actions, id }: Props) {
  const styles = useStyles2(editorColumnStyles);

  return (
    <div className={styles.container}>
      <Label className={styles.label} id={id}>
        {label}
      </Label>
      <Stack direction="row" gap={1}>
        {actions}
      </Stack>
    </div>
  );
}

const editorColumnStyles = (theme: GrafanaTheme2) => ({
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
