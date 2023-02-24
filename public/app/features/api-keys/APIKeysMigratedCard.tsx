import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, ConfirmModal, useStyles2, Button } from '@grafana/ui';

interface Props {
  onHideApiKeys: () => void;
  apikeys: number;
}

export const APIKeysMigratedCard = ({ onHideApiKeys, apikeys }: Props): JSX.Element => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const styles = useStyles2(getStyles);

  return (
    <Alert title="If you see any API keys please migrate them to Service account tokens." severity="info">
      <div className={styles.text}>
        Migrated API keys are safe and continue working as they used to. You can find them inside the respective service
        account.
      </div>
      <div className={styles.actionRow}>
        <Button className={styles.actionButton} onClick={() => setIsModalOpen(true)} disabled={apikeys !== 0}>
          Hide API keys page
        </Button>
        <ConfirmModal
          title={'Hide API Keys page'}
          isOpen={isModalOpen}
          body={'Did you want to hide the API keys page?'}
          confirmText={'Yes, hide API keys page.'}
          onConfirm={onHideApiKeys}
          onDismiss={() => setIsModalOpen(false)}
          confirmButtonVariant="primary"
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
