import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { FetchError } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { Button, ConfirmModal, Modal, useStyles2 } from '@grafana/ui';

import { DashboardModel } from '../../state/DashboardModel';

import { SaveDashboardAsButton } from './SaveDashboardButton';
import { SaveDashboardModalProps } from './types';
import { useDashboardSave } from './useDashboardSave';

interface SaveDashboardErrorProxyProps {
  /** original dashboard */
  dashboard: DashboardModel;
  /** dashboard save model with applied modifications, i.e. title */
  dashboardSaveModel: Dashboard;
  error: FetchError;
  onDismiss: () => void;
  setErrorIsHandled: React.Dispatch<React.SetStateAction<boolean>>;
}

export const SaveDashboardErrorProxy = ({
  dashboard,
  dashboardSaveModel,
  error,
  onDismiss,
  setErrorIsHandled,
}: SaveDashboardErrorProxyProps) => {
  const { onDashboardSave } = useDashboardSave();

  return (
    <>
      {error.data && error.data.status === 'version-mismatch' && (
        <ConfirmModal
          isOpen={true}
          title="Conflict"
          body={
            <div>
              Someone else has updated this dashboard <br /> <small>Would you still like to save this dashboard?</small>
            </div>
          }
          confirmText="Save and overwrite"
          onConfirm={async () => {
            await onDashboardSave(dashboardSaveModel, { overwrite: true }, dashboard);
            onDismiss();
          }}
          onDismiss={onDismiss}
        />
      )}
      {error.data && error.data.status === 'name-exists' && (
        <ConfirmModal
          isOpen={true}
          title="Conflict"
          body={
            <div>
              A dashboard with the same name in selected folder already exists. <br />
              <small>Would you still like to save this dashboard?</small>
            </div>
          }
          confirmText="Save and overwrite"
          onConfirm={async () => {
            await onDashboardSave(dashboardSaveModel, { overwrite: true }, dashboard);
            onDismiss();
          }}
          onDismiss={onDismiss}
        />
      )}
      {error.data && error.data.status === 'plugin-dashboard' && (
        <ConfirmPluginDashboardSaveModal
          dashboard={dashboard}
          onDismiss={() => {
            setErrorIsHandled(true);
            onDismiss();
          }}
        />
      )}
    </>
  );
};

const ConfirmPluginDashboardSaveModal = ({ onDismiss, dashboard }: SaveDashboardModalProps) => {
  const { onDashboardSave } = useDashboardSave();
  const styles = useStyles2(getConfirmPluginDashboardSaveModalStyles);

  return (
    <Modal className={styles.modal} title="Plugin dashboard" icon="copy" isOpen={true} onDismiss={onDismiss}>
      <div className={styles.modalText}>
        Your changes will be lost when you update the plugin.
        <br />
        <small>
          Use <strong>Save As</strong> to create custom version.
        </small>
      </div>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          Cancel
        </Button>
        <SaveDashboardAsButton onClick={onDismiss} dashboard={dashboard} onSaveSuccess={onDismiss} />
        <Button
          variant="destructive"
          onClick={async () => {
            await onDashboardSave(dashboard.getSaveModelClone(), { overwrite: true }, dashboard);
            onDismiss();
          }}
        >
          Overwrite
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};

export const proxyHandlesError = (errorStatus: string) => {
  switch (errorStatus) {
    case 'version-mismatch':
    case 'name-exists':
    case 'plugin-dashboard':
      return true;

    default:
      return false;
  }
};

const getConfirmPluginDashboardSaveModalStyles = (theme: GrafanaTheme2) => ({
  modal: css`
    width: 500px;
  `,
  modalText: css`
    font-size: ${theme.typography.h4.fontSize};
    color: ${theme.colors.text.primary};
    margin-bottom: ${theme.spacing(4)}
    padding-top: ${theme.spacing(2)};
  `,
  modalButtonRow: css`
    margin-bottom: 14px;
    a,
    button {
      margin-right: ${theme.spacing(2)};
    }
  `,
});
