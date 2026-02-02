import { FC, useEffect, useMemo, useReducer } from 'react';

import { LoadingState } from '@grafana/data';
import { Button, Modal, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { getModalStyles } from '../../styles';
import { LibraryElementDTO } from '../../types';
import { asyncDispatcher } from '../LibraryPanelsView/actions';

import { getConnectedDashboards } from './actions';
import { deleteLibraryPanelModalReducer, initialDeleteLibraryPanelModalState } from './reducer';

interface Props {
  libraryPanel: LibraryElementDTO;
  onConfirm: () => void;
  onDismiss: () => void;
}

export const DeleteLibraryPanelModal: FC<Props> = ({ libraryPanel, onDismiss, onConfirm }) => {
  const styles = useStyles2(getModalStyles);
  const [{ dashboardTitles, loadingState }, dispatch] = useReducer(
    deleteLibraryPanelModalReducer,
    initialDeleteLibraryPanelModalState
  );
  const asyncDispatch = useMemo(() => asyncDispatcher(dispatch), [dispatch]);
  useEffect(() => {
    asyncDispatch(getConnectedDashboards(libraryPanel));
  }, [asyncDispatch, libraryPanel]);
  const connected = Boolean(dashboardTitles.length);
  const done = loadingState === LoadingState.Done;

  return (
    <Modal
      className={styles.modal}
      // BMC Change: Next line
      title={t('bmcgrafana.library-panels.delete.title', 'Delete library panel')}
      icon="trash-alt"
      onDismiss={onDismiss}
      isOpen={true}
    >
      {!done ? <LoadingIndicator /> : null}
      {done ? (
        <div>
          {connected ? <HasConnectedDashboards dashboardTitles={dashboardTitles} /> : null}
          {!connected ? <Confirm /> : null}

          <Modal.ButtonRow>
            <Button variant="secondary" onClick={onDismiss} fill="outline">
              <Trans i18nKey={'library-panel.modal.button-cancel'}>Cancel</Trans>
            </Button>
            <Button variant="destructive" onClick={onConfirm} disabled={connected}>
              <Trans i18nKey={'bmcgrafana.library-panels.delete.delete-text'}>Delete</Trans>
            </Button>
          </Modal.ButtonRow>
        </div>
      ) : null}
    </Modal>
  );
};

const LoadingIndicator = () => (
  <span>
    <Trans i18nKey={'bmcgrafana.library-panels.delete.loading-text'}>Loading library panel...</Trans>
  </span>
);

const Confirm = () => {
  const styles = useStyles2(getModalStyles);

  return (
    <div className={styles.modalText}>
      <Trans i18nKey={'bmcgrafana.library-panels.delete.confirmation-text'}>Do you want to delete this panel?</Trans>
    </div>
  );
};

const HasConnectedDashboards: FC<{ dashboardTitles: string[] }> = ({ dashboardTitles }) => {
  const styles = useStyles2(getModalStyles);
  // BMC Change: Starts
  // For localization ease removing logic to calculate suffix.
  // const suffix = dashboardTitles.length === 1 ? 'dashboard.' : 'dashboards.';
  const message = `${dashboardTitles.length}`;
  // BMC Change: Ends
  if (dashboardTitles.length === 0) {
    return null;
  }

  return (
    <div>
      <p className={styles.textInfo}>
        {/* BMC Change: To enable localization for below text */}
        {t(
          'bmcgrafana.library-panels.delete.cannot-delete-text',
          'This library panel can not be deleted because it is connected to {{message}} dashboard(s). Remove the library panel from the dashboards listed below and retry.',
          { message }
        )}
      </p>
      <table className={styles.myTable}>
        <thead>
          <tr>
            <th>
              {/* BMC Change: Next line */}
              <Trans i18nKey={'bmcgrafana.library-panels.delete.dashboard-name-title'}>Dashboard name</Trans>
            </th>
          </tr>
        </thead>
        <tbody>
          {dashboardTitles.map((title, i) => (
            <tr key={`dash-title-${i}`}>
              <td>{title}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
