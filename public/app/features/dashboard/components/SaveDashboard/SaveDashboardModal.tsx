import React, { useMemo, useState } from 'react';
import { Modal } from '@grafana/ui';
import { css } from '@emotion/css';
import { SaveDashboardForm } from './forms/SaveDashboardForm';
import { SaveDashboardErrorProxy } from './SaveDashboardErrorProxy';
import { useDashboardSave } from './useDashboardSave';
import { SaveDashboardModalProps, SaveDashboardOptions, SaveDashboardData } from './types';

export const SaveDashboardModal: React.FC<SaveDashboardModalProps> = ({ dashboard, onDismiss, onSaveSuccess }) => {
  const { state, onDashboardSave } = useDashboardSave(dashboard);
  const [dashboardSaveModelClone, setDashboardSaveModelClone] = useState();
  const [options, setOptions] = useState<SaveDashboardOptions>({});

  const data = useMemo<SaveDashboardData>(() => {
    const clone = dashboard.getSaveModelClone({
      saveTimerange: Boolean(options.saveTimerange),
      saveVariables: Boolean(options.saveVariables),
    });

    return { clone, diff: {}, diffCount: 0, hasChanges: true };
  }, [dashboard, options]);

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
            saveModel={data}
            options={options}
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
            onOptionsChange={setOptions}
          />
        </Modal>
      )}
    </>
  );
};
