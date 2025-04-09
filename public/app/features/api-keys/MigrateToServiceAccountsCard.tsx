import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, ConfirmModal, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

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
      <Trans i18nKey="api-keys.migrate-to-service-accounts-card.docs-link.about-migration">
        Find out more about the migration here.
      </Trans>
    </a>
  );
  const migrationBoxDesc = (
    <span>
      <Trans i18nKey="api-keys.migrate-to-service-accounts-card.migration-box-desc.migrating">
        Migrating all API keys will hide the API keys tab.
      </Trans>
    </span>
  );

  return (
    <>
      {apikeysCount > 0 && (
        <Alert
          title={t(
            'api-keys.migrate-to-service-accounts-card.title-switch-service-accounts',
            'Switch from API keys to service accounts'
          )}
          severity="warning"
        >
          <div className={styles.text}>
            <Trans
              i18nKey="api-keys.migrate-to-service-accounts-card.body-switch-service-accounts"
              components={{ docsLink }}
            >
              API keys are deprecated and will be removed from Grafana on Jan 31, 2025. Each API key will be migrated
              into a service account with a token and will continue to work as they were. We encourage you to migrate
              your API keys to service accounts now. {'<docsLink />'}
            </Trans>
          </div>
          <div className={styles.actionRow}>
            <Button className={styles.actionButton} onClick={() => setIsModalOpen(true)}>
              <Trans i18nKey="api-keys.migrate-to-service-accounts-card.migrate-all-service-accounts">
                Migrate all service accounts
              </Trans>
            </Button>
            <ConfirmModal
              title={t('api-keys.migrate-to-service-accounts-card.modal-title', 'Migrate API keys to service accounts')}
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
          <Alert
            title={t('api-keys.migrate-to-service-accounts-card.title-no-api-keys-found', 'No API keys found')}
            severity="warning"
          >
            <div className={styles.text}>
              <Trans i18nKey="api-keys.migrate-to-service-accounts-card.body-no-api-keys-found">
                No API keys were found. If you reload the browser, this page will not be available anymore.
              </Trans>
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
