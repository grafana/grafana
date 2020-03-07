import React from 'react';
import { css } from 'emotion';
import { Modal } from '@grafana/ui';
import { SaveDashboardAsForm } from './forms/SaveDashboardAsForm';
import { SaveDashboardErrorProxy } from './SaveDashboardErrorProxy';
import { useDashboardSave } from './useDashboardSave';
import { SaveDashboardModalProps } from './types';

export const SaveDashboardAsModal: React.FC<SaveDashboardModalProps & {
  isNew?: boolean;
}> = ({ dashboard, onDismiss, isNew }) => {
  const { state, onDashboardSave } = useDashboardSave(dashboard);

  return (
    <>
      {state.error && <SaveDashboardErrorProxy error={state.error} dashboard={dashboard} onDismiss={onDismiss} />}
      {!state.error && (
        <Modal
          isOpen={true}
          title="Save dashboard as..."
          icon="copy"
          onDismiss={onDismiss}
          className={css`
            width: 500px;
          `}
        >
          <SaveDashboardAsForm
            dashboard={dashboard}
            onCancel={onDismiss}
            onSuccess={onDismiss}
            onSubmit={onDashboardSave}
            isNew={isNew}
          />
        </Modal>
      )}
    </>
  );
};
