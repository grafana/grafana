import React from 'react';
import { Modal } from '@grafana/ui';
import { SaveDashboardAsForm } from './forms/SaveDashboardAsForm';
import { SaveDashboardErrorProxy } from './SaveDashboardErrorProxy';
import { useDashboardSave } from './useDashboardSave';
import { SaveDashboardModalProps } from './types';

export const SaveDashboardAsModal: React.FC<SaveDashboardModalProps & {
  isNew?: boolean;
}> = ({ dashboard, onClose, isNew }) => {
  const { state, onDashboardSave } = useDashboardSave(dashboard);

  return (
    <>
      {state.error && <SaveDashboardErrorProxy error={state.error} dashboard={dashboard} onClose={onClose} />}
      {!state.error && (
        <Modal isOpen={true} title="Save dashboard as..." icon="copy" onDismiss={onClose}>
          <SaveDashboardAsForm
            dashboard={dashboard}
            onCancel={onClose}
            onSuccess={onClose}
            onSubmit={onDashboardSave}
            isNew={isNew}
          />
        </Modal>
      )}
    </>
  );
};
