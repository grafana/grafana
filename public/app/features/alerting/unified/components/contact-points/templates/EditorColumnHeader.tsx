import { css } from '@emotion/css';
import * as React from 'react';
import { type MergeExclusive } from 'type-fest';

import { GrafanaTheme2 } from '@grafana/data';
import { Label, Stack, useStyles2 } from '@grafana/ui';

interface BaseProps {
  id?: string;
}

interface ChildrenProps extends BaseProps {
  children: React.ReactNode;
}

interface LabelActionsProps extends BaseProps {
  label: string;
  actions?: React.ReactNode;
}

type Props = MergeExclusive<ChildrenProps, LabelActionsProps>;

export function EditorColumnHeader({ label, actions, id, children }: Props) {
  const styles = useStyles2(editorColumnStyles);

  return (
    <div className={styles.container}>
      {children ?? (
        <>
          <Label className={styles.label} id={id}>
            {label}
          </Label>
          {actions && (
            <Stack direction="row" gap={1}>
              {actions}
            </Stack>
          )}
        </>
      )}
    </div>
  );
}

const editorColumnStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
    padding: theme.spacing(1, 2),
    backgroundColor: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderTopLeftRadius: theme.shape.radius.default,
    borderTopRightRadius: theme.shape.radius.default,
  }),
  label: css({
    margin: 0,
  }),
});
