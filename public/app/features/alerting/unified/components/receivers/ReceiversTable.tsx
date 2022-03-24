import { Button, ConfirmModal, Modal, useStyles2 } from '@grafana/ui';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import React, { FC, useMemo, useState } from 'react';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { getAlertTableStyles } from '../../styles/table';
import { extractNotifierTypeCounts } from '../../utils/receivers';
import { ActionIcon } from '../rules/ActionIcon';
import { ReceiversSection } from './ReceiversSection';
import { makeAMLink } from '../../utils/misc';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { isReceiverUsed } from '../../utils/alertmanager';
import { useDispatch } from 'react-redux';
import { deleteReceiverAction } from '../../state/actions';
import { isVanillaPrometheusAlertManagerDataSource, isGrafanaRulesSource } from '../../utils/datasource';
import { Authorize } from '../../components/Authorize';
import { AccessControlAction } from 'app/types';
import { contextSrv } from 'app/core/core';

interface Props {
  config: AlertManagerCortexConfig;
  alertManagerName: string;
}

export const ReceiversTable: FC<Props> = ({ config, alertManagerName }) => {
  const dispatch = useDispatch();
  const tableStyles = useStyles2(getAlertTableStyles);
  const styles = useStyles2(getStyles);
  const isVanillaAM = isVanillaPrometheusAlertManagerDataSource(alertManagerName);
  const isGrafanaAM = isGrafanaRulesSource(alertManagerName);
  const grafanaNotifiers = useUnifiedAlertingSelector((state) => state.grafanaNotifiers);

  // receiver name slated for deletion. If this is set, a confirmation modal is shown. If user approves, this receiver is deleted
  const [receiverToDelete, setReceiverToDelete] = useState<string>();
  const [showCannotDeleteReceiverModal, setShowCannotDeleteReceiverModal] = useState(false);

  const onClickDeleteReceiver = (receiverName: string): void => {
    if (isReceiverUsed(receiverName, config)) {
      setShowCannotDeleteReceiverModal(true);
    } else {
      setReceiverToDelete(receiverName);
    }
  };

  const deleteReceiver = () => {
    if (receiverToDelete) {
      dispatch(deleteReceiverAction(receiverToDelete, alertManagerName));
    }
    setReceiverToDelete(undefined);
  };

  const rows = useMemo(
    () =>
      config.alertmanager_config.receivers?.map((receiver) => ({
        name: receiver.name,
        types: Object.entries(extractNotifierTypeCounts(receiver, grafanaNotifiers.result ?? [])).map(
          ([type, count]) => {
            if (count > 1) {
              return `${type} (${count})`;
            }
            return type;
          }
        ),
      })) ?? [],
    [config, grafanaNotifiers.result]
  );

  return (
    <ReceiversSection
      className={styles.section}
      title="Contact points"
      description="Define where the notifications will be sent to, for example email or Slack."
      showButton={
        !isVanillaAM &&
        contextSrv.hasPermission(
          isGrafanaAM
            ? AccessControlAction.AlertingNotificationsCreate
            : AccessControlAction.AlertingNotificationsExternalWrite
        )
      }
      addButtonLabel="New contact point"
      addButtonTo={makeAMLink('/alerting/notifications/receivers/new', alertManagerName)}
    >
      <table className={tableStyles.table} data-testid="receivers-table">
        <colgroup>
          <col />
          <col />
          <Authorize
            actions={
              isGrafanaAM
                ? [AccessControlAction.AlertingNotificationsUpdate, AccessControlAction.AlertingNotificationsDelete]
                : [AccessControlAction.AlertingNotificationsExternalWrite]
            }
          >
            <col />
          </Authorize>
        </colgroup>
        <thead>
          <tr>
            <th>Contact point name</th>
            <th>Type</th>
            <Authorize
              actions={
                isGrafanaAM
                  ? [AccessControlAction.AlertingNotificationsUpdate, AccessControlAction.AlertingNotificationsDelete]
                  : [AccessControlAction.AlertingNotificationsExternalWrite]
              }
            >
              <th>Actions</th>
            </Authorize>
          </tr>
        </thead>
        <tbody>
          {!rows.length && (
            <tr className={tableStyles.evenRow}>
              <td colSpan={3}>No receivers defined.</td>
            </tr>
          )}
          {rows.map((receiver, idx) => (
            <tr key={receiver.name} className={idx % 2 === 0 ? tableStyles.evenRow : undefined}>
              <td>{receiver.name}</td>
              <td>{receiver.types.join(', ')}</td>
              <Authorize
                actions={
                  isGrafanaAM
                    ? [AccessControlAction.AlertingNotificationsUpdate, AccessControlAction.AlertingNotificationsDelete]
                    : [AccessControlAction.AlertingNotificationsExternalWrite]
                }
              >
                <td className={tableStyles.actionsCell}>
                  {!isVanillaAM && (
                    <>
                      <Authorize
                        actions={
                          isGrafanaAM
                            ? [AccessControlAction.AlertingNotificationsUpdate]
                            : [AccessControlAction.AlertingNotificationsExternalWrite]
                        }
                      >
                        <ActionIcon
                          aria-label="Edit"
                          data-testid="edit"
                          to={makeAMLink(
                            `/alerting/notifications/receivers/${encodeURIComponent(receiver.name)}/edit`,
                            alertManagerName
                          )}
                          tooltip="Edit contact point"
                          icon="pen"
                        />
                      </Authorize>
                      <Authorize
                        actions={
                          isGrafanaAM
                            ? [AccessControlAction.AlertingNotificationsDelete]
                            : [AccessControlAction.AlertingNotificationsExternalWrite]
                        }
                      >
                        <ActionIcon
                          onClick={() => onClickDeleteReceiver(receiver.name)}
                          tooltip="Delete contact point"
                          icon="trash-alt"
                        />
                      </Authorize>
                    </>
                  )}
                  {isVanillaAM && (
                    <Authorize actions={[AccessControlAction.AlertingNotificationsExternalWrite]}>
                      <ActionIcon
                        data-testid="view"
                        to={makeAMLink(
                          `/alerting/notifications/receivers/${encodeURIComponent(receiver.name)}/edit`,
                          alertManagerName
                        )}
                        tooltip="View contact point"
                        icon="file-alt"
                      />
                    </Authorize>
                  )}
                </td>
              </Authorize>
            </tr>
          ))}
        </tbody>
      </table>
      {!!showCannotDeleteReceiverModal && (
        <Modal
          isOpen={true}
          title="Cannot delete contact point"
          onDismiss={() => setShowCannotDeleteReceiverModal(false)}
        >
          <p>
            Contact point cannot be deleted because it is used in more policies. Please update or delete these policies
            first.
          </p>
          <Modal.ButtonRow>
            <Button variant="secondary" onClick={() => setShowCannotDeleteReceiverModal(false)} fill="outline">
              Close
            </Button>
          </Modal.ButtonRow>
        </Modal>
      )}
      {!!receiverToDelete && (
        <ConfirmModal
          isOpen={true}
          title="Delete contact point"
          body={`Are you sure you want to delete contact point "${receiverToDelete}"?`}
          confirmText="Yes, delete"
          onConfirm={deleteReceiver}
          onDismiss={() => setReceiverToDelete(undefined)}
        />
      )}
    </ReceiversSection>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  section: css`
    margin-top: ${theme.spacing(4)};
  `,
});
