import { css, cx } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
  Alert,
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
import { loadDataSources } from 'app/features/datasources/state/actions';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { useExternalAmSelector, useExternalDataSourceAlertmanagers } from '../../hooks/useExternalAmSelector';

import { AddAlertManagerModal } from './AddAlertManagerModal';
import { ExternalAlertmanagerDataSources } from './ExternalAlertmanagerDataSources';

const alertmanagerChoices: Array<SelectableValue<AlertmanagerChoice>> = [
  { value: AlertmanagerChoice.Internal, label: 'Only Internal' },
  { value: AlertmanagerChoice.External, label: 'Only External' },
  { value: AlertmanagerChoice.All, label: 'Both internal and external' },
];

export const ExternalAlertmanagers = () => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const [modalState, setModalState] = useState({ open: false, payload: [{ url: '' }] });
  const [deleteModalState, setDeleteModalState] = useState({ open: false, index: 0 });

  const externalAlertManagers = useExternalAmSelector();
  const externalDsAlertManagers = useExternalDataSourceAlertmanagers();

  const {
    useSaveExternalAlertmanagersConfigMutation,
    useGetExternalAlertmanagerConfigQuery,
    useGetExternalAlertmanagersQuery,
  } = alertmanagerApi;

  const [saveExternalAlertManagers] = useSaveExternalAlertmanagersConfigMutation();
  const { currentData: externalAlertmanagerConfig } = useGetExternalAlertmanagerConfigQuery();

  // Just to refresh the status periodically
  useGetExternalAlertmanagersQuery(undefined, { pollingInterval: 5000 });

  const alertmanagersChoice = externalAlertmanagerConfig?.alertmanagersChoice;
  const theme = useTheme2();

  useEffect(() => {
    dispatch(loadDataSources());
  }, [dispatch]);

  const onDelete = useCallback(
    (index: number) => {
      // to delete we need to filter the alertmanager from the list and repost
      const newList = (externalAlertManagers ?? [])
        .filter((am, i) => i !== index)
        .map((am) => {
          return am.url;
        });

      saveExternalAlertManagers({
        alertmanagers: newList,
        alertmanagersChoice: alertmanagersChoice ?? AlertmanagerChoice.All,
      });

      setDeleteModalState({ open: false, index: 0 });
    },
    [externalAlertManagers, saveExternalAlertManagers, alertmanagersChoice]
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

  const onChangeAlertmanagerChoice = (alertmanagersChoice: AlertmanagerChoice) => {
    saveExternalAlertManagers({ alertmanagers: externalAlertManagers.map((am) => am.url), alertmanagersChoice });
  };

  const onChangeAlertmanagers = (alertmanagers: string[]) => {
    saveExternalAlertManagers({
      alertmanagers,
      alertmanagersChoice: alertmanagersChoice ?? AlertmanagerChoice.All,
    });
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
      <Alert title="External Alertmanager changes" severity="info">
        The way you configure external Alertmanagers has changed.
        <br />
        You can now use configured Alertmanager data sources as receivers of your Grafana-managed alerts.
        <br />
        For more information, refer to our documentation.
      </Alert>

      <ExternalAlertmanagerDataSources
        alertmanagers={externalDsAlertManagers}
        inactive={alertmanagersChoice === AlertmanagerChoice.Internal}
      />

      <div className={styles.amChoice}>
        <Field
          label="Send alerts to"
          description="Configures how the Grafana alert rule evaluation engine Alertmanager handles your alerts. Internal (Grafana built-in Alertmanager), External (All Alertmanagers configured above), or both."
        >
          <RadioButtonGroup
            options={alertmanagerChoices}
            value={alertmanagersChoice}
            onChange={(value) => onChangeAlertmanagerChoice(value!)}
          />
        </Field>
      </div>

      <h5>Alertmanagers by URL</h5>
      <Alert severity="warning" title="Deprecation Notice">
        The URL-based configuration of Alertmanagers is deprecated and will be removed in Grafana 9.2.0.
        <br />
        Use Alertmanager data sources to configure your external Alertmanagers.
      </Alert>

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

export const getStyles = (theme: GrafanaTheme2) => ({
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
  amChoice: css`
    margin-bottom: ${theme.spacing(4)};
  `,
});
