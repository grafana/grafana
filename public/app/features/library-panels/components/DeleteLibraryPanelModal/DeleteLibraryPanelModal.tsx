import React, { FC, useEffect, useMemo, useReducer } from 'react';

import { LoadingState } from '@grafana/data';
import { Button, Modal, useStyles2 } from '@grafana/ui';

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
    <Modal className={styles.modal} title="Delete library panel" icon="trash-alt" onDismiss={onDismiss} isOpen={true}>
      {!done ? <LoadingIndicator /> : null}
      {done ? (
        <div>
          {connected ? <HasConnectedDashboards dashboardTitles={dashboardTitles} /> : null}
          {!connected ? <Confirm /> : null}

          <Modal.ButtonRow>
            <Button variant="secondary" onClick={onDismiss} fill="outline">
              Cancel
            </Button>
            <Button variant="destructive" onClick={onConfirm} disabled={connected}>
              Delete
            </Button>
          </Modal.ButtonRow>
        </div>
      ) : null}
    </Modal>
  );
};

const LoadingIndicator = () => <span>Loading library panel...</span>;

const Confirm = () => {
  const styles = useStyles2(getModalStyles);

  return <div className={styles.modalText}>Do you want to delete this panel?</div>;
};

const HasConnectedDashboards: FC<{ dashboardTitles: string[] }> = ({ dashboardTitles }) => {
  const styles = useStyles2(getModalStyles);
  const suffix = dashboardTitles.length === 1 ? 'dashboard.' : 'dashboards.';
  const message = `${dashboardTitles.length} ${suffix}`;
  if (dashboardTitles.length === 0) {
    return null;
  }

  return (
    <div>
      <p className={styles.textInfo}>
        {'This library panel can not be deleted because it is connected to '}
        <strong>{message}</strong>
        {' Remove the library panel from the dashboards listed below and retry.'}
      </p>
      <table className={styles.myTable}>
        <thead>
          <tr>
            <th>Dashboard name</th>
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
