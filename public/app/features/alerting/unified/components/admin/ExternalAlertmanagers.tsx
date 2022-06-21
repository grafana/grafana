import { css, cx } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import {
  Button,
  ConfirmModal,
  Field,
  HorizontalGroup,
  Icon,
  RadioButtonGroup,
  Tooltip,
  useStyles2,
  useTheme2,
} from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { StoreState } from 'app/types/store';

import { useExternalAmSelector } from '../../hooks/useExternalAmSelector';
import {
  addExternalAlertmanagersAction,
  fetchExternalAlertmanagersAction,
  fetchExternalAlertmanagersConfigAction,
} from '../../state/actions';

import { AddAlertManagerModal } from './AddAlertManagerModal';

const alertmanagerChoices = [
  { value: 'internal', label: 'Only Internal' },
  { value: 'external', label: 'Only External' },
  { value: 'all', label: 'Both internal and external' },
];

export const ExternalAlertmanagers = () => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const [modalState, setModalState] = useState({ open: false, payload: [{ url: '' }] });
  const [deleteModalState, setDeleteModalState] = useState({ open: false, index: 0 });

  const externalAlertManagers = useExternalAmSelector();
  const alertmanagersChoice = useSelector(
    (state: StoreState) => state.unifiedAlerting.externalAlertmanagers.alertmanagerConfig.result?.alertmanagersChoice
  );
  const theme = useTheme2();

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
      dispatch(
        addExternalAlertmanagersAction({ alertmanagers: newList, alertmanagersChoice: alertmanagersChoice ?? 'all' })
      );
      setDeleteModalState({ open: false, index: 0 });
    },
    [externalAlertManagers, dispatch, alertmanagersChoice]
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

  const onChangeAlertmanagerChoice = (alertmanagersChoice: string) => {
    dispatch(
      addExternalAlertmanagersAction({ alertmanagers: externalAlertManagers.map((am) => am.url), alertmanagersChoice })
    );
  };

  const onChangeAlertmanagers = (alertmanagers: string[]) => {
    dispatch(addExternalAlertmanagersAction({ alertmanagers, alertmanagersChoice: alertmanagersChoice ?? 'all' }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return theme.colors.success.main;

      case 'pending':
        return theme.colors.warning.main;

      default:
        return theme.colors.error.main;
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
        <>
          <table className={cx('filter-table form-inline filter-table--hover', styles.table)}>
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
          <div>
            <Field
              label="Send alerts to"
              description="Sets which Alertmanager will handle your alerts. Internal (Grafana built in Alertmanager), External (All Alertmanagers configured above), or both."
            >
              <RadioButtonGroup
                options={alertmanagerChoices}
                value={alertmanagersChoice}
                onChange={(value) => onChangeAlertmanagerChoice(value!)}
              />
            </Field>
          </div>
        </>
      )}
      <ConfirmModal
        isOpen={deleteModalState.open}
        title="Remove Alertmanager"
        body="Are you sure you want to remove this Alertmanager"
        confirmText="Remove"
        onConfirm={() => onDelete(deleteModalState.index)}
        onDismiss={() => setDeleteModalState({ open: false, index: 0 })}
      />
      {modalState.open && (
        <AddAlertManagerModal
          onClose={onCloseModal}
          alertmanagers={modalState.payload}
          onChangeAlertmanagerConfig={onChangeAlertmanagers}
        />
      )}
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
  table: css`
    margin-bottom: ${theme.spacing(2)};
  `,
});
