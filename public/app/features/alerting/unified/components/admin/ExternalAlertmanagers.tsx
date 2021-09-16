import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, HorizontalGroup, Icon, useStyles2 } from '@grafana/ui';
import { AddAlertManagerModal } from './AddAlertManagerModal';
import { fetchExternalAlertmanagersAction } from '../../state/actions';
import { StoreState } from 'app/types';
import { initialAsyncRequestState } from '../../utils/redux';

export const ExternalAlertmanagers = () => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const [modalOpen, setModalState] = useState<boolean>(false);
  const externalAlertManagers = useSelector((state: StoreState) => state.unifiedAlerting.externalAlertManagers);

  const { result: alertmanagers, loading: isLoadingAlertmanagers, error: loadingError } =
    externalAlertManagers || initialAsyncRequestState;

  useEffect(() => {
    dispatch(fetchExternalAlertmanagersAction());
  }, [dispatch]);

  const onDelete = useCallback(() => {
    // dispatch delete
  }, []);

  return (
    <div>
      <h4>External Alertmanagers</h4>
      <div className={styles.muted}>
        If you are running Grafana in HA mode, you can point Prometheus to a list of Alertmanagers. Use the source URL
        input below to discover alertmanagers.
      </div>
      <div className={styles.actions}>
        <Button type="button" onClick={() => setModalState(true)}>
          Add Alertmanager
        </Button>
      </div>
      {loadingError && (
        <Alert severity="error" title="Error loading external Alertmanagers">
          {loadingError.message || 'Unknown error.'}
        </Alert>
      )}
      {alertmanagers && (
        <table className="filter-table form-inline filter-table--hover">
          <thead>
            <tr>
              <th>Url</th>
              <th style={{ width: '2%' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {alertmanagers.data.activeAlertManagers.map((am, index) => {
              return (
                <tr key={index}>
                  <td className="link-td">{am.url}</td>
                  <td>
                    <HorizontalGroup>
                      <Icon name="pen" />
                      <Button type="button" onClick={onDelete}>
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
      {modalOpen && (
        <AddAlertManagerModal
          onClose={() => setModalState(false)}
          alertmanagers={alertmanagers ? alertmanagers.data.activeAlertManagers : [{ url: '' }]}
        />
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
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
