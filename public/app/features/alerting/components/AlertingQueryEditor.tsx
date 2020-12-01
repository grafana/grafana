import React, { FC } from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';

interface Props {}

export const AlertingQueryEditor: FC<Props> = () => {
  const styles = useStyles(getStyles);

  return (
    <div className={styles.container}>
      <h4>Queries</h4>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    container: css`
      padding-left: ${theme.spacing.md};
      background-color: ${theme.colors.panelBg};
    `,
    editorWrapper: css`
      border: 1px solid ${theme.colors.panelBorder};
      border-radius: ${theme.border.radius.md};
    `,
  };
};
