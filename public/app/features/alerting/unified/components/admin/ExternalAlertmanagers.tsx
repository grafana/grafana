import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, ConfirmModal, HorizontalGroup, Icon, Tooltip, useStyles2 } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { AddAlertManagerModal } from './AddAlertManagerModal';
import {
  addExternalAlertmanagersAction,
  fetchExternalAlertmanagersAction,
  fetchExternalAlertmanagersConfigAction,
} from '../../state/actions';
import { useExternalAmSelector } from '../../hooks/useExternalAmSelector';

export const ExternalAlertmanagers = () => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const [modalState, setModalState] = useState({ open: false, payload: [{ url: '' }] });
  const [deleteModalState, setDeleteModalState] = useState({ open: false, index: 0 });
  const externalAlertManagers = useExternalAmSelector();

  useEffect(() => {
    dispatch(fetchExternalAlertmanagersAction());
    dispatch(fetchExternalAlertmanagersConfigAction());
    const interval = setInterval(() => dispatch(fetchExternalAlertmanagersAction()), 5000);

    return () => {
      clearInterval(interval);
    };
  }, [dispatch]);

  const onDelete = useCallback(
    (index: number) => {
      // to delete we need to filter the alertmanager from the list and repost
      const newList = (externalAlertManagers ?? [])
        .filter((am, i) => i !== index)
        .map((am) => {
          return am.url;
        });
      dispatch(addExternalAlertmanagersAction(newList));
      setDeleteModalState({ open: false, index: 0 });
    },
    [externalAlertManagers, dispatch]
  );

  const onEdit = useCallback(() => {
    const ams = externalAlertManagers ? [...externalAlertManagers] : [{ url: '' }];
    setModalState((state) => ({
      ...state,
      open: true,
      payload: ams,
    }));
  }, [setModalState, externalAlertManagers]);

  const onOpenModal = useCallback(() => {
    setModalState((state) => {
      const ams = externalAlertManagers ? [...externalAlertManagers, { url: '' }] : [{ url: '' }];
      return {
        ...state,
        open: true,
        payload: ams,
      };
    });
  }, [externalAlertManagers]);

  const onCloseModal = useCallback(() => {
    setModalState((state) => ({
      ...state,
      open: false,
    }));
  }, [setModalState]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'green';

      case 'pending':
        return 'yellow';

      default:
        return 'red';
    }
  };

  const noAlertmanagers = externalAlertManagers?.length === 0;

  return (
    <div>
      <h4>External Alertmanagers</h4>
      <div className={styles.muted}>
        You can have your Grafana managed alerts be delivered to one or many external Alertmanager(s) in addition to the
        internal Alertmanager by specifying their URLs below.
      </div>
      <div className={styles.actions}>
        {!noAlertmanagers && (
          <Button type="button" onClick={onOpenModal}>
            Add Alertmanager
          </Button>
        )}
      </div>
      {noAlertmanagers ? (
        <EmptyListCTA
          title="You have not added any external alertmanagers"
          onClick={onOpenModal}
          buttonTitle="Add Alertmanager"
          buttonIcon="bell-slash"
        />
      ) : (
        <table className="filter-table form-inline filter-table--hover">
          <thead>
            <tr>
              <th>Url</th>
              <th>Status</th>
              <th style={{ width: '2%' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {externalAlertManagers?.map((am, index) => {
              return (
                <tr key={index}>
                  <td>
                    <span className={styles.url}>{am.url}</span>
                    {am.actualUrl ? (
                      <Tooltip content={`Discovered ${am.actualUrl} from ${am.url}`} theme="info">
                        <Icon name="info-circle" />
                      </Tooltip>
                    ) : null}
                  </td>
                  <td>
                    <Icon name="heart" style={{ color: getStatusColor(am.status) }} title={am.status} />
                  </td>
                  <td>
                    <HorizontalGroup>
                      <Button variant="secondary" type="button" onClick={onEdit} aria-label="Edit alertmanager">
                        <Icon name="pen" />
                      </Button>
                      <Button
                        variant="destructive"
                        aria-label="Remove alertmanager"
                        type="button"
                        onClick={() => setDeleteModalState({ open: true, index })}
                      >
                        <Icon name="trash-alt" />
                      </Button>
                    </HorizontalGroup>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <ConfirmModal
        isOpen={deleteModalState.open}
        title="Remove Alertmanager"
        body="Are you sure you want to remove this Alertmanager"
        confirmText="Remove"
        onConfirm={() => onDelete(deleteModalState.index)}
        onDismiss={() => setDeleteModalState({ open: false, index: 0 })}
      />
      {modalState.open && <AddAlertManagerModal onClose={onCloseModal} alertmanagers={modalState.payload} />}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  url: css`
    margin-right: ${theme.spacing(1)};
  `,
  muted: css`
    color: ${theme.colors.text.secondary};
  `,
  actions: css`
    margin-top: ${theme.spacing(2)};
    display: flex;
    justify-content: flex-end;
  `,
  table: css``,
});
