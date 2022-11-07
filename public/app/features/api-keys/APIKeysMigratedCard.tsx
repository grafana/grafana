import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, ConfirmModal, useStyles2, Button } from '@grafana/ui';

interface Props {
  onHideApiKeys: () => void;
}

export const APIKeysMigratedCard = ({ onHideApiKeys }: Props): JSX.Element => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const styles = useStyles2(getStyles);

  return (
    <Alert title="API keys were migrated to Grafana service accounts. This tab is deprecated." severity="info">
      <div className={styles.text}>
        We have migrated API keys into Grafana service accounts. All API keys are safe and continue working as they used
        to, you can find them inside the respective service account.
      </div>
      <div className={styles.actionRow}>
        <Button className={styles.actionButton} onClick={() => setIsModalOpen(true)}>
          Hide API keys page forever
        </Button>
        <ConfirmModal
          title={'Hide API Keys page forever'}
          isOpen={isModalOpen}
          body={'Are you sure you want to hide API keys page forever and use service accounts from now on?'}
          confirmText={'Yes, hide API keys page.'}
          onConfirm={onHideApiKeys}
          onDismiss={() => setIsModalOpen(false)}
        />
        <a href="org/serviceaccounts">View service accounts page</a>
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
