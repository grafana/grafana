import React, { useState } from 'react';
import { Modal } from '@grafana/ui';
import { css } from 'emotion';
import { SaveDashboardForm } from './forms/SaveDashboardForm';
import { SaveDashboardErrorProxy } from './SaveDashboardErrorProxy';
import { useDashboardSave } from './useDashboardSave';
import { SaveDashboardModalProps } from './types';

export const SaveDashboardModal: React.FC<SaveDashboardModalProps> = ({ dashboard, onDismiss, onSaveSuccess }) => {
  const { state, onDashboardSave } = useDashboardSave(dashboard);
  const [dashboardSaveModelClone, setDashboardSaveModelClone] = useState();
  return (
    <>
      {state.error && (
        <SaveDashboardErrorProxy
          error={state.error}
          dashboard={dashboard}
          dashboardSaveModel={dashboardSaveModelClone}
          onDismiss={onDismiss}
        />
      )}
      {!state.error && (
        <Modal
          isOpen={true}
          title="Save dashboard"
          icon="copy"
          onDismiss={onDismiss}
          className={css`
            width: 500px;
          `}
        >
          <SaveDashboardForm
            dashboard={dashboard}
            onCancel={onDismiss}
            onSuccess={() => {
              onDismiss();
              if (onSaveSuccess) {
                onSaveSuccess();
              }
            }}
            onSubmit={(clone, options, dashboard) => {
              setDashboardSaveModelClone(clone);
              return onDashboardSave(clone, options, dashboard);
            }}
          />
        </Modal>
      )}
    </>
  );
};
