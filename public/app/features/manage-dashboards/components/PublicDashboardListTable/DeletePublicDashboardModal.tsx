import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { ConfirmModal, useStyles2 } from '@grafana/ui';

const Body = () => {
  const styles = useStyles2(getStyles);

  return (
    <p className={styles.description}>
      {config.featureToggles.newDashboardSharingComponent
        ? t(
            'shared-dashboard.delete-modal.revoke-body-text',
            'Are you sure you want to revoke this access? The dashboard can no longer be shared.'
          )
        : t(
            'public-dashboard.delete-modal.revoke-body-text',
            'Are you sure you want to revoke this URL? The dashboard will no longer be public.'
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
  const translatedRevocationModalText = config.featureToggles.newDashboardSharingComponent
    ? t('shared-dashboard.delete-modal.revoke-title', 'Revoke access')
    : t('public-dashboard.delete-modal.revoke-title', 'Revoke public URL');
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
  title: css({
    marginBottom: theme.spacing(1),
  }),
  description: css({
    fontSize: theme.typography.body.fontSize,
  }),
});
