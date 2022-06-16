import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, LinkButton, useStyles2 } from '@grafana/ui';

interface Props {
  onHideApiKeys: () => void;
}

export const APIKeysMigratedCard = ({ onHideApiKeys }: Props): JSX.Element => {
  const styles = useStyles2(getStyles);

  return (
    <Alert title="API keys were migrated to Service accounts. This tab is deprecated." severity="info">
      <div className={styles.text}>
        We have upgraded your API keys into more powerful Service accounts and tokens. All your keys are safe and
        working - you will find them inside respective service accounts. Keys are now called tokens.
      </div>
      <div className={styles.actionRow}>
        <LinkButton className={styles.actionButton} href="org/serviceaccounts" onClick={onHideApiKeys}>
          Go to service accounts tab and never show API keys tab again
        </LinkButton>
        <a href="org/serviceaccounts">Go to service accounts tab</a>
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
