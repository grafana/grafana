import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, ConfirmModal, useStyles2 } from '@grafana/ui';

interface Props {
  onMigrate: () => void;
  apikeysCount: number;
  disabled?: boolean;
}

export const MigrateToServiceAccountsCard = ({ onMigrate, apikeysCount, disabled }: Props): JSX.Element => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const styles = useStyles2(getStyles);

  const docsLink = (
    <a
      className="external-link"
      href="https://grafana.com/docs/grafana/latest/administration/service-accounts/migrate-api-keys/"
      target="_blank"
      rel="noopener noreferrer"
    >
      Find out more about the migration here.
    </a>
  );
  const migrationBoxDesc = <span>Migrating all API keys will hide the API keys tab.</span>;

  return (
    <>
      {apikeysCount > 0 && (
        <Alert title="Switch from API keys to service accounts" severity="warning">
          <div className={styles.text}>
            API keys are deprecated and will be removed from Grafana on Jan 31, 2025. Each API key will be migrated into
            a service account with a token and will continue to work as they were. We encourage you to migrate your API
            keys to service accounts now. {docsLink}
          </div>
          <div className={styles.actionRow}>
            <Button className={styles.actionButton} onClick={() => setIsModalOpen(true)}>
              Migrate all service accounts
            </Button>
            <ConfirmModal
              title={'Migrate API keys to Service accounts'}
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
      )}
      {apikeysCount === 0 && (
        <>
          <Alert title="No API keys found" severity="warning">
            <div className={styles.text}>
              No API keys were found. If you reload the browser, this page will not be available anymore.
            </div>
          </Alert>
        </>
      )}
    </>
  );
};

export const getStyles = (theme: GrafanaTheme2) => ({
  text: css({
    marginBottom: theme.spacing(2),
  }),
  actionRow: css({
    display: 'flex',
    alignItems: 'center',
  }),
  actionButton: css({
    marginRight: theme.spacing(2),
  }),
});
