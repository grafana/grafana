import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, useStyles2 } from '@grafana/ui';

interface Props {
  onMigrate: () => void;
  disabled?: boolean;
}

export const MigrateToServiceAccountsCard = ({ onMigrate, disabled }: Props): JSX.Element => {
  const styles = useStyles2(getStyles);

  return (
    <Alert title="Switch from API keys to Service accounts" severity="info">
      <div className={styles.text}>
        Service accounts give you more control. API keys will be automatically migrated into tokens inside respective
        service accounts. The current API keys will still work, but will be called tokens and you will find them in the
        detail view of a respective service account.
      </div>
      <div className={styles.actionRow}>
        {!disabled && (
          <Button className={styles.actionButton} onClick={onMigrate}>
            Migrate now
          </Button>
        )}
        <span>Read more about Service accounts and how to turn them on</span>
      </div>
    </Alert>
  );
};

export const getStyles = (theme: GrafanaTheme2) => ({
  text: css`
    margin-bottom: ${theme.spacing(2)};
  `,
  actionRow: css`
    display: flex;
    align-items: center;
  `,
  actionButton: css`
    margin-right: ${theme.spacing(2)};
  `,
});
