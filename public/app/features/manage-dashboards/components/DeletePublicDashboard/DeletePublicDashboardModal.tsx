import React from 'react';

import { ConfirmModal } from '@grafana/ui/src';

const Body = ({ title }: { title?: string }) => (
  <>
    <p>Do you want to delete this public dashboard?</p>
    <p>
      Only &quot;<b>{title}</b>&quot; public dashboard will be deleted.
    </p>
  </>
);

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
