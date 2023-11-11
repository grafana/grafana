import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { ConfirmModal, useStyles2 } from '@grafana/ui/src';
import { t } from 'app/core/internationalization';

const Body = ({ title }: { title?: string }) => {
  const styles = useStyles2(getStyles);

  return (
    <p className={styles.description}>
      {title
        ? t(
            'delete-public-dashboard-modal.public-dashboard.ask-for-revoke-nonorphaned',
            'Are you sure you want to revoke this URL? The dashboard will no longer be public.'
          )
        : t(
            'delete-public-dashboard-modal.public-dashboard.ask-for-revoke-orphaned',
            'Orphaned public dashboard will no longer be public.'
          )}
    </p>
  );
};

export const DeletePublicDashboardModal = ({
  dashboardTitle,
  onConfirm,
  onDismiss,
}: {
  dashboardTitle?: string;
  onConfirm: () => void;
  onDismiss: () => void;
}) => {
  const translatedRevocationModalText = t(
    'delete-public-dashboard-modal.public-dashboard.confirm-revocation-title',
    'Revoke public URL'
  );
  return (
    <ConfirmModal
      isOpen
      body={<Body title={dashboardTitle} />}
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
