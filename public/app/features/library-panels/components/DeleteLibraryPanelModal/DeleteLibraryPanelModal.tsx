import React, { FC, useEffect, useMemo, useReducer } from 'react';
import { Button, HorizontalGroup, Modal, useStyles } from '@grafana/ui';
import { LoadingState } from '@grafana/data';

import { LibraryPanelDTO } from '../../types';
import { asyncDispatcher } from '../LibraryPanelsView/actions';
import { deleteLibraryPanelModalReducer, initialDeleteLibraryPanelModalState } from './reducer';
import { getConnectedDashboards } from './actions';
import { getModalStyles } from '../../styles';

interface Props {
  libraryPanel: LibraryPanelDTO;
  onConfirm: () => void;
  onDismiss: () => void;
}

export const DeleteLibraryPanelModal: FC<Props> = ({ libraryPanel, onDismiss, onConfirm }) => {
  const styles = useStyles(getModalStyles);
  const [{ dashboardTitles, loadingState }, dispatch] = useReducer(
    deleteLibraryPanelModalReducer,
    initialDeleteLibraryPanelModalState
  );
  const asyncDispatch = useMemo(() => asyncDispatcher(dispatch), [dispatch]);
  useEffect(() => {
    asyncDispatch(getConnectedDashboards(libraryPanel));
  }, []);
  const connected = Boolean(dashboardTitles.length);
  const done = loadingState === LoadingState.Done;

  return (
    <Modal className={styles.modal} title="Delete library panel" icon="trash-alt" onDismiss={onDismiss} isOpen={true}>
      {!done ? <LoadingIndicator /> : null}
      {done ? (
        <div>
          {connected ? <HasConnectedDashboards dashboardTitles={dashboardTitles} /> : null}
          {!connected ? <Confirm /> : null}

          <HorizontalGroup>
            <Button variant="destructive" onClick={onConfirm} disabled={connected}>
              Delete
            </Button>
            <Button variant="secondary" onClick={onDismiss}>
              Cancel
            </Button>
          </HorizontalGroup>
        </div>
      ) : null}
    </Modal>
  );
};

const LoadingIndicator: FC = () => <span>Loading library panel...</span>;

const Confirm: FC = () => {
  const styles = useStyles(getModalStyles);

  return <div className={styles.modalText}>Do you want to delete this panel?</div>;
};

const HasConnectedDashboards: FC<{ dashboardTitles: string[] }> = ({ dashboardTitles }) => {
  const styles = useStyles(getModalStyles);
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
