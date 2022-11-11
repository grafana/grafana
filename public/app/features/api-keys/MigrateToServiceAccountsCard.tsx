import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, ConfirmModal, useStyles2 } from '@grafana/ui';

interface Props {
  onMigrate: () => void;
  disabled?: boolean;
}

export const MigrateToServiceAccountsCard = ({ onMigrate, disabled }: Props): JSX.Element => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const styles = useStyles2(getStyles);

  const docsLink = (
    <a
      className="external-link"
      href="https://grafana.com/docs/grafana/latest/administration/api-keys/#migrate-api-keys-to-grafana-service-accounts/"
      target="_blank"
      rel="noopener noreferrer"
    >
      here.
    </a>
  );
  const migrationBoxDesc = (
    <span>Are you sure you want to migrate all API keys to service accounts? Find out more {docsLink}</span>
  );

  return (
    <Alert title="Switch from API keys to service accounts" severity="info">
      <div className={styles.text}>
        Each API key will be automatically migrated into a service account with a token. The service account will be
        created with the same permission as the API Key and current API Keys will continue to work as they were.
      </div>
      <div className={styles.actionRow}>
        <Button className={styles.actionButton} onClick={() => setIsModalOpen(true)}>
          Migrate to service accounts now
        </Button>
        <ConfirmModal
          title={'Migrate API keys to service accounts'}
          isOpen={isModalOpen}
          body={migrationBoxDesc}
          confirmText={'Yes, migrate now'}
          onConfirm={onMigrate}
          onDismiss={() => setIsModalOpen(false)}
        />
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
