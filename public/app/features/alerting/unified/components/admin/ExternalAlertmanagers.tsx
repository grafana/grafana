import { css, cx } from '@emotion/css';
import { capitalize } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
  Alert,
  Badge,
  Button,
  CallToActionCard,
  Card,
  ConfirmModal,
  Field,
  HorizontalGroup,
  Icon,
  LinkButton,
  RadioButtonGroup,
  Tooltip,
  useStyles2,
  useTheme2,
} from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { loadDataSources } from 'app/features/datasources/state/actions';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { StoreState } from 'app/types/store';

import {
  ExternalDataSourceAM,
  useExternalAmSelector,
  useExternalDataSourceAlertmanagers,
} from '../../hooks/useExternalAmSelector';
import {
  addExternalAlertmanagersAction,
  fetchExternalAlertmanagersAction,
  fetchExternalAlertmanagersConfigAction,
} from '../../state/actions';
import { makeDataSourceLink } from '../../utils/misc';

import { AddAlertManagerModal } from './AddAlertManagerModal';

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

  const alertmanagersChoice = useSelector(
    (state: StoreState) => state.unifiedAlerting.externalAlertmanagers.alertmanagerConfig.result?.alertmanagersChoice
  );
  const theme = useTheme2();

  useEffect(() => {
    dispatch(fetchExternalAlertmanagersAction());
    dispatch(fetchExternalAlertmanagersConfigAction());
    dispatch(loadDataSources());
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
        addExternalAlertmanagersAction({
          alertmanagers: newList,
          alertmanagersChoice: alertmanagersChoice ?? AlertmanagerChoice.All,
        })
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

  const onChangeAlertmanagerChoice = (alertmanagersChoice: AlertmanagerChoice) => {
    dispatch(
      addExternalAlertmanagersAction({ alertmanagers: externalAlertManagers.map((am) => am.url), alertmanagersChoice })
    );
  };

  const onChangeAlertmanagers = (alertmanagers: string[]) => {
    dispatch(
      addExternalAlertmanagersAction({
        alertmanagers,
        alertmanagersChoice: alertmanagersChoice ?? AlertmanagerChoice.All,
      })
    );
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
  const noDsAlertmanagers = externalDsAlertManagers?.length === 0;
  const hasExternalAlertmanagers = !(noAlertmanagers && noDsAlertmanagers);

  return (
    <div>
      <h4>External Alertmanagers</h4>
      <Alert title="External alertmanagers changes" severity="info">
        We changed the way of management of external Alertmanagers
        <br />
        From now on, you can use configured Alertmanager data sources as receivers of your Grafana-managed alerts
        <br />
        Check our documentation to find our more.
      </Alert>

      <ExternalAlertmanagerDataSources
        alertmanagers={externalDsAlertManagers}
        inactive={alertmanagersChoice === AlertmanagerChoice.Internal}
      />

      {hasExternalAlertmanagers && (
        <div className={styles.amChoice}>
          <Field
            label="Send alerts to"
            description="Configures how the Grafana alert rule evaluation engine Alertmanager will handle your alerts. Internal (Grafana built-in Alertmanager), External (All Alertmanagers configured above), or both."
          >
            <RadioButtonGroup
              options={alertmanagerChoices}
              value={alertmanagersChoice}
              onChange={(value) => onChangeAlertmanagerChoice(value!)}
            />
          </Field>
        </div>
      )}

      <h5>Alertmanagers by URL</h5>
      <Alert severity="warning" title="Deprecation Notice">
        The URL-based configuration of Alertmanagers is now deprecated and will be removed in Grafana 9.2.0
        <br />
        Please use Alertmanager data sources to configure your external Alertmanagers.
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

interface ExternalAlertManagerDataSourcesProps {
  alertmanagers: ExternalDataSourceAM[];
  inactive: boolean;
}

function ExternalAlertmanagerDataSources({ alertmanagers, inactive }: ExternalAlertManagerDataSourcesProps) {
  const styles = useStyles2(getStyles);

  return (
    <>
      <h5>Alertmanagers data sources</h5>
      <div className={styles.muted}>
        Alertmanager data sources support a configuration setting that allows you to choose to send Grafana-managed
        alerts to that Alertmanager. <br />
        Below, you can see the list of all Alertmanager data sources that have this setting enabled.
      </div>
      {alertmanagers.length === 0 && (
        <CallToActionCard
          message={
            <div>
              There are no Alertmanager data sources configured to receive Grafana-managed alerts <br />
              You can change this by selecting Receive Grafana Alerts in a data source configuration
            </div>
          }
          callToActionElement={<LinkButton href="/datasources">Go to data sources</LinkButton>}
          className={styles.externalDsCTA}
        />
      )}
      {alertmanagers.length > 0 && (
        <div className={styles.externalDs}>
          {alertmanagers.map((am) => (
            <ExternalAMdataSourceCard key={am.dataSource.uid} alertmanager={am} inactive={inactive} />
          ))}
        </div>
      )}
    </>
  );
}

interface ExternalAMdataSourceCardProps {
  alertmanager: ExternalDataSourceAM;
  inactive: boolean;
}

function ExternalAMdataSourceCard({ alertmanager, inactive }: ExternalAMdataSourceCardProps) {
  const styles = useStyles2(getStyles);

  const { dataSource, status, statusInconclusive, url } = alertmanager;

  return (
    <Card>
      <Card.Heading className={styles.externalHeading}>
        {dataSource.name}{' '}
        {statusInconclusive && (
          <Tooltip content="Multiple Alertmangers have the same URL configured. The state might be inconclusive">
            <Icon name="exclamation-triangle" size="md" className={styles.externalWarningIcon} />
          </Tooltip>
        )}
      </Card.Heading>
      <Card.Figure>
        <img
          src="public/app/plugins/datasource/alertmanager/img/logo.svg"
          alt=""
          height="40px"
          width="40px"
          style={{ objectFit: 'contain' }}
        />
      </Card.Figure>
      <Card.Tags>
        {inactive ? (
          <Badge
            text="Inactive"
            color="red"
            tooltip="Grafana is configured to send alerts to the built-in internal alermanager only. External Alertmanages will not receive any alerts"
          />
        ) : (
          <Badge
            text={capitalize(status)}
            color={status === 'dropped' ? 'red' : status === 'active' ? 'green' : 'orange'}
          />
        )}
      </Card.Tags>
      <Card.Meta>{url}</Card.Meta>
      <Card.Actions>
        <LinkButton href={makeDataSourceLink(dataSource)} size="sm" variant="secondary">
          Go to datasouce
        </LinkButton>
      </Card.Actions>
    </Card>
  );
}

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
  amChoice: css`
    margin-bottom: ${theme.spacing(4)};
  `,
  externalStatus: css`
    align-self: flex-start;
    justify-self: flex-end;
  `,
  externalHeading: css`
    justify-content: flex-start;
  `,
  externalWarningIcon: css`
    margin: ${theme.spacing(0, 1)};
    fill: ${theme.colors.warning.main};
  `,
  externalDs: css`
    display: grid;
    gap: ${theme.spacing(1)};
    padding: ${theme.spacing(2, 0)};
  `,
  externalDsCTA: css`
    margin: ${theme.spacing(2, 0)};
  `,
  externalDsAddRow: css`
    display: flex;
    flex-direction: row;
    gap: ${theme.spacing(2)};
    align-items: center;
    padding-bottom: ${theme.spacing(3)};
  `,
});
