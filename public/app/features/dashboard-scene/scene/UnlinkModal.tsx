import React from 'react';

import { ConfirmModal } from '@grafana/ui';

interface Props {
  isOpen: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}

export const UnlinkModal = ({ isOpen, onConfirm, onDismiss }: Props) => {
  return (
    <ConfirmModal
      title="Do you really want to unlink this panel?"
      icon="question-circle"
      body="If you unlink this panel, you will be able to edit it without affecting any other dashboards.
            However, once you make a change you will not be able to revert to its original reusable panel."
      confirmText="Yes, unlink"
      onConfirm={() => {
        onConfirm();
        onDismiss();
      }}
      onDismiss={onDismiss}
      isOpen={isOpen}
    />
  );
};
