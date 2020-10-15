import React from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { Button, Icon, useStyles } from '@grafana/ui';

export const AlertingToolbar = () => {
  const styles = useStyles(getStyles);

  return (
    <div className={styles.toolbar}>
      <div style={{ flexGrow: 0 }}>
        <Icon
          name="bell"
          size="lg"
          className={css`
            margin-right: 6px;
            margin-bottom: 3px;
          `}
        />
        Alert editor
      </div>
      <div style={{ flexGrow: 1, display: 'flex', justifyContent: 'flex-end' }}>
        <div className={styles.actions}>
          <Button variant="destructive">Discard</Button>
          <Button variant="primary">Save</Button>
          <Button variant="secondary">Test</Button>
        </div>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    toolbar: css`
      padding: ${theme.spacing.sm} ${theme.spacing.md} 0;
      font-size: ${theme.typography.size.lg};
      display: flex;
      justify-content: flex-start;
      align-items: center;
      margin-bottom: ${theme.spacing.md};
    `,
    actions: css`
      display: flex;
      justify-content: space-between;
    `,
  };
};
