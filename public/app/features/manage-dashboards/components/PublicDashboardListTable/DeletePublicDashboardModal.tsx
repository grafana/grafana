import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data/src';
import { ConfirmModal, useStyles2 } from '@grafana/ui/src';
import { t } from 'app/core/internationalization';

const Body = () => {
  const styles = useStyles2(getStyles);

  return (
    <p className={styles.description}>
      {t(
        'public-dashboard.delete-modal.revoke-body-text',
        'Are you sure you want to revoke this access? The dashboard can no longer be shared.'
      )}
    </p>
  );
};

export const DeletePublicDashboardModal = ({
  onConfirm,
  onDismiss,
}: {
  onConfirm: () => void;
  onDismiss: () => void;
}) => {
  const translatedRevocationModalText = t('public-dashboard.delete-modal.revoke-title', 'Revoke access');
  return (
    <ConfirmModal
      isOpen
      body={<Body />}
      onConfirm={onConfirm}
      onDismiss={onDismiss}
      title={translatedRevocationModalText}
      icon="trash-alt"
      confirmText={translatedRevocationModalText}
    />
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  title: css`
    margin-bottom: ${theme.spacing(1)};
  `,
  description: css`
    font-size: ${theme.typography.body.fontSize};
  `,
});
