import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { ConfirmModal, useStyles2 } from '@grafana/ui/src';

const Body = ({ title }: { title?: string }) => {
  const styles = useStyles2(getStyles);

  return (
    <p className={styles.description}>
      {title
        ? 'Are you sure you want to revoke this URL? The dashboard will no longer be public.'
        : 'Orphaned public dashboard will no longer be public.'}
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
}) => (
  <ConfirmModal
    isOpen={true}
    body={<Body title={dashboardTitle} />}
    onConfirm={onConfirm}
    onDismiss={onDismiss}
    title="Revoke public URL"
    icon="trash-alt"
    confirmText="Revoke public URL"
  />
);

const getStyles = (theme: GrafanaTheme2) => ({
  title: css`
    margin-bottom: ${theme.spacing(1)};
  `,
  description: css`
    font-size: ${theme.typography.body.fontSize};
  `,
});
