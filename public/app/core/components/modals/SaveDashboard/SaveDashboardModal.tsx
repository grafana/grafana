import React, { useEffect } from 'react';
import { css } from 'emotion';
import { Modal, HorizontalGroup, ConfirmModal, Button, stylesFactory, useTheme, ModalsController } from '@grafana/ui';
import { DashboardModel } from '../../../../features/dashboard/state';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { getBackendSrv } from '../../../services/backend_srv';
import { AppEvents, GrafanaTheme } from '@grafana/data';
import { SaveDashboardOptions } from './types';
import { NEW_DASHBOARD_DEFAULT_TITLE, SaveDashboardAsForm } from './forms/SaveDashboardAsForm';
import { SaveDashboardForm } from './forms/SaveDashboardForm';
import { SaveProvisionedDashboardForm } from './forms/SaveProvisionedDashboardForm';
import appEvents from 'app/core/app_events';
import { updateLocation } from 'app/core/actions';
import { LocationState, StoreState } from '../../../../types';
import { connect, useDispatch, useSelector } from 'react-redux';
import locationUtil from 'app/core/utils/location_util';

const saveDashboard = async (saveModel: any, options: SaveDashboardOptions, dashboard: DashboardModel) => {
  const folderId = options.folderId >= 0 ? options.folderId : dashboard.meta.folderId || saveModel.folderId;
  return await getBackendSrv().saveDashboard(saveModel, { ...options, folderId });
};

interface SaveDashboardModalProxyProps {
  dashboard: DashboardModel;
  onClose: () => void;
}

interface SaveDashboardModalProps extends SaveDashboardModalProxyProps {}

type Props = SaveDashboardModalProxyProps;

const useDashboardSave = (dashboard: DashboardModel) => {
  const location = useSelector((state: StoreState) => state.location);
  const dispatch = useDispatch();
  const [state, onDashboardSave] = useAsyncFn(
    async (clone: any, options: SaveDashboardOptions, dashboard: DashboardModel) =>
      await saveDashboard(clone, options, dashboard),
    []
  );

  useEffect(() => {
    if (state.value) {
      dashboard.version = state.value.version;

      // important that these happen before location redirect below
      // AppEve.appEvent(CoreEvents.dashboardSaved, this.dashboard);
      appEvents.emit(AppEvents.alertSuccess, ['Dashboard saved']);
      debugger;
      const newUrl = locationUtil.stripBaseFromUrl(state.value.url);
      const currentPath = location.path;

      console.log(newUrl, currentPath);

      if (newUrl !== currentPath) {
        dispatch(
          updateLocation({
            path: newUrl,
          })
        );
      }
    }
  }, [state]);

  return { state, onDashboardSave };
};

export const SaveDashboardModalProxy: React.FC<Props> = ({ dashboard, onClose, location }) => {
  const isProvisioned = dashboard.meta.provisioned;
  const isNew = dashboard.title === NEW_DASHBOARD_DEFAULT_TITLE;
  const isChanged = dashboard.version > 0;

  return (
    <>
      {/*{state.error && (*/}
      {/*  <SaveDashboardErrorProxy*/}
      {/*    error={state.error}*/}
      {/*    dashboard={dashboard}*/}
      {/*    onDashboardSave={onDashboardSave}*/}
      {/*    onClose={onClose}*/}
      {/*  />*/}
      {/*)}*/}
      {isChanged && !isProvisioned && <SaveDashboardModal dashboard={dashboard} onClose={onClose} />}
      {isProvisioned && <SaveProvisionedDashboard dashboard={dashboard} onClose={onClose} />}
      {isNew && <SaveDashboardAsModal dashboard={dashboard} onClose={onClose} isNew />}
    </>
  );
};

interface SaveDashboardErrorProxyProps {
  dashboard: DashboardModel;
  error: any;
  onClose: () => void;
}

const SaveDashboardErrorProxy: React.FC<SaveDashboardErrorProxyProps> = ({ dashboard, error, onClose }) => {
  const { state, onDashboardSave } = useDashboardSave(dashboard);

  return (
    <>
      {error.data && error.data.status === 'version-mismatch' && (
        <ConfirmModal
          isOpen={true}
          title="Conflict"
          body={
            <div>
              Someone else has updated this dashboard <br /> Would you still like to save this dashboard?.
            </div>
          }
          confirmText="Save & Overwrite"
          onConfirm={async () => {
            await onDashboardSave(dashboard.getSaveModelClone(), { overwrite: true }, dashboard);
          }}
          onDismiss={onClose}
        />
      )}
      {error.data && error.data.status === 'name-exists' && (
        <ConfirmModal
          isOpen={true}
          title="Conflict"
          body={
            <div>
              A dashboard with the same name in selected folder already exists. <br /> Would you still like to save this
              dashboard?.
            </div>
          }
          confirmText="Save & Overwrite"
          onConfirm={async () => {
            await saveDashboard(dashboard.getSaveModelClone(), { overwrite: true }, dashboard);
          }}
          onDismiss={onClose}
        />
      )}
      {error.data && error.data.status === 'plugin-dashboard' && (
        <ConfirmPluginDashboardSaveModal dashboard={dashboard} onClose={onClose} onSubmit={onDashboardSave} />
      )}
    </>
  );
};

const ConfirmPluginDashboardSaveModal: React.FC<SaveDashboardModalProps> = ({ onSubmit, onClose, dashboard }) => {
  const theme = useTheme();
  const getStyles = stylesFactory((theme: GrafanaTheme) => ({
    modal: css`
      width: 500px;
    `,
    modalContent: css`
      text-align: center;
    `,
    modalText: css`
      font-size: ${theme.typography.heading.h4};
      color: ${theme.colors.link};
      margin-bottom: calc(${theme.spacing.d} * 2);
      padding-top: ${theme.spacing.d};
    `,
    modalButtonRow: css`
      margin-bottom: 14px;
      a,
      button {
        margin-right: ${theme.spacing.d};
      }
    `,
  }));
  const styles = getStyles(theme);
  return (
    <Modal className={styles.modal} title="Plugin Dashboard" icon="copy" isOpen={true} onDismiss={() => {}}>
      <div className={styles.modalContent}>
        <div className={styles.modalText}>
          Your changes will be lost when you update the plugin. Use Save As to create custom version.
        </div>
        <HorizontalGroup>
          <Button variant="danger" onClick={() => {}}>
            Overwrite
          </Button>
          <ModalsController>
            {({ showModal, hideModal }) => {
              return (
                <Button
                  variant="danger"
                  onClick={() => {
                    showModal(SaveDashboardAsModal, {
                      dashboard,
                      onClose: hideModal,
                    });
                  }}
                >
                  Save as
                </Button>
              );
            }}
          </ModalsController>

          <Button variant="inverse" onClick={onClose}>
            Cancel
          </Button>
        </HorizontalGroup>
      </div>
    </Modal>
  );
};

const SaveDashboardModal: React.FC<SaveDashboardModalProps> = ({ dashboard, onClose }) => {
  const { state, onDashboardSave } = useDashboardSave(dashboard);
  return (
    <>
      {state.error && <SaveDashboardErrorProxy error={state.error} dashboard={dashboard} onClose={onClose} />}
      {!state.error && (
        <Modal isOpen={true} title="Save dashboard" icon="copy" onDismiss={onClose}>
          <SaveDashboardForm dashboard={dashboard} onCancel={onClose} onSuccess={onClose} onSubmit={onDashboardSave} />
        </Modal>
      )}
    </>
  );
};

const SaveDashboardAsModal: React.FC<SaveDashboardModalProps & {
  isNew: boolean;
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

const SaveProvisionedDashboard: React.FC<SaveDashboardModalProps> = ({ dashboard, onClose }) => {
  return (
    <Modal isOpen={true} title="Cannot save provisioned dashboard" icon="copy" onDismiss={onClose}>
      <SaveProvisionedDashboardForm dashboard={dashboard} onCancel={onClose} onSuccess={onClose} />
    </Modal>
  );
};
