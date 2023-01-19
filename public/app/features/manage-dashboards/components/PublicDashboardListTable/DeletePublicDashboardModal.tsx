import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { ConfirmModal, useStyles2 } from '@grafana/ui/src';

const Body = ({ title }: { title?: string }) => {
  const styles = useStyles2(getStyles);

  return (
    <>
      <p className={styles.title}>Do you want to delete this public dashboard?</p>
      <p className={styles.description}>
        {title
          ? `This will delete the public dashboard for "${title}". Your dashboard will not be deleted.`
          : 'Orphaned public dashboard will be deleted'}
      </p>
    </>
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
    title="Delete"
    icon="trash-alt"
    confirmText="Delete"
  />
);

const getStyles = (theme: GrafanaTheme2) => ({
  title: css`
    margin-bottom: ${theme.spacing(1)};
  `,
  description: css`
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});
