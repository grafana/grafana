import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, HorizontalGroup, Icon, useStyles2 } from '@grafana/ui';
import { AddAlertManagerModal } from './AddAlertManagerModal';
import {
  addExternalAlertmanagers,
  fetchExternalAlertmanagersAction,
  fetchExternalAlertmanagersConfigAction,
} from '../../state/actions';
import { useExternalAmSelector } from '../../hooks/useExternalAmSelector';

export const ExternalAlertmanagers = () => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const [modalState, setModalState] = useState({ open: false, payload: [{ url: '' }] });
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
      const newList = externalAlertManagers!
        .filter((am, i) => i !== index)
        .map((am) => {
          return am.url;
        });
      dispatch(addExternalAlertmanagers(newList));
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

  const onAdd = useCallback(() => {
    setModalState((state) => {
      const ams = externalAlertManagers ? [...externalAlertManagers, { url: '' }] : [{ url: '' }];
      return {
        ...state,
        open: true,
        payload: ams,
      };
    });
  }, [externalAlertManagers]);

  const onClose = useCallback(() => {
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
  console.log(externalAlertManagers);
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
      {externalAlertManagers && (
        <table className="filter-table form-inline filter-table--hover">
          <thead>
            <tr>
              <th>Url</th>
              <th>Status</th>
              <th style={{ width: '2%' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {externalAlertManagers.map((am, index) => {
              return (
                <tr key={index}>
                  <td className="link-td">{am.url}</td>
                  <td>
                    <Icon name="heart" style={{ color: getStatusColor(am.status) }} title={am.status} />
                  </td>
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
