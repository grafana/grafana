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
      href="https://grafana.com/docs/grafana/latest/administration/api-keys/#migrate-api-keys-to-grafana-service-accounts"
      target="_blank"
      rel="noopener noreferrer"
    >
      Find out more about the migration here.
    </a>
  );
  const migrationBoxDesc = <span>Are you sure you want to migrate all API keys to service accounts? {docsLink}</span>;

  return (
    <Alert title="Switch from API keys to service accounts" severity="warning">
      <div className={styles.text}>
        We will soon deprecate API keys. Each API key will be migrated into a service account with a token and will
        continue to work as they were. We encourage you to migrate your API keys to service accounts now. {docsLink}
      </div>
      <div className={styles.actionRow}>
        <Button className={styles.actionButton} onClick={() => setIsModalOpen(true)}>
          Migrate all service accounts
        </Button>
        <ConfirmModal
          title={'Migrate API keys to service accounts'}
          isOpen={isModalOpen}
          body={migrationBoxDesc}
          confirmText={'Yes, migrate now'}
          onConfirm={onMigrate}
          onDismiss={() => setIsModalOpen(false)}
          confirmVariant="primary"
          confirmButtonVariant="primary"
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
