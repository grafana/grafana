import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, HorizontalGroup, Icon, useStyles2 } from '@grafana/ui';
import { AddAlertManagerModal } from './AddAlertManagerModal';
import { addExternalAlertmanagers, fetchExternalAlertmanagersAction } from '../../state/actions';
import { StoreState } from 'app/types';
import { initialAsyncRequestState } from '../../utils/redux';

export const ExternalAlertmanagers = () => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const [modalState, setModalState] = useState({ open: false, payload: [{ url: '' }] });
  const externalAlertManagers = useSelector((state: StoreState) => state.unifiedAlerting.externalAlertManagers);

  const { result: alertmanagers, loading: isLoadingAlertmanagers, error: loadingError } =
    externalAlertManagers || initialAsyncRequestState;

  useEffect(() => {
    dispatch(fetchExternalAlertmanagersAction());
  }, [dispatch]);

  const onDelete = useCallback(
    (index: number) => {
      // to delete we need to filter the alertmanager from the list and repost
      const newList = alertmanagers!.data.activeAlertManagers
        .filter((am, i) => i !== index)
        .map((am) => {
          return am.url;
        });
      dispatch(addExternalAlertmanagers(newList));
    },
    [alertmanagers, dispatch]
  );

  const onEdit = useCallback(() => {
    const ams = alertmanagers ? [...alertmanagers.data.activeAlertManagers] : [{ url: '' }];
    setModalState((state) => ({
      ...state,
      open: true,
      payload: ams,
    }));
  }, [setModalState, alertmanagers]);

  const onAdd = useCallback(() => {
    setModalState((state) => {
      const ams = alertmanagers ? [...alertmanagers.data.activeAlertManagers, { url: '' }] : [{ url: '' }];
      return {
        ...state,
        open: true,
        payload: ams,
      };
    });
  }, [alertmanagers]);

  const onClose = useCallback(() => {
    setModalState((state) => ({
      ...state,
      open: false,
    }));
  }, [setModalState]);

  return (
    <div>
      <h4>External Alertmanagers</h4>
      <div className={styles.muted}>
        If you are running Grafana in HA mode, you can point Prometheus to a list of Alertmanagers. Use the source URL
        input below to discover alertmanagers.
      </div>
      <div className={styles.actions}>
        <Button type="button" onClick={onAdd}>
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
                      <Button variant="secondary" type="button" onClick={onEdit}>
                        <Icon name="pen" />
                      </Button>
                      <Button variant="secondary" type="button" onClick={() => onDelete(index)}>
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
      {modalState.open && <AddAlertManagerModal onClose={onClose} alertmanagers={modalState.payload} />}
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
