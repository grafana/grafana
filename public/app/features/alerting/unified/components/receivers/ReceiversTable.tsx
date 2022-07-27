import { css } from '@emotion/css';
import pluralize from 'pluralize';
import React, { FC, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, ConfirmModal, Modal, useStyles2, Badge } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AlertManagerCortexConfig, Receiver } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction, ContactPointsState, ReceiversState } from 'app/types';

import { Authorize } from '../../components/Authorize';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { deleteReceiverAction } from '../../state/actions';
import { getAlertTableStyles } from '../../styles/table';
import { getNotificationsPermissions } from '../../utils/access-control';
import { isReceiverUsed } from '../../utils/alertmanager';
import { isVanillaPrometheusAlertManagerDataSource } from '../../utils/datasource';
import { makeAMLink } from '../../utils/misc';
import { extractNotifierTypeCounts } from '../../utils/receivers';
import { initialAsyncRequestState } from '../../utils/redux';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';
import { ProvisioningBadge } from '../Provisioning';
import { ActionIcon } from '../rules/ActionIcon';

import { ReceiversSection } from './ReceiversSection';

interface UpdateActionProps extends ActionProps {
  onClickDeleteReceiver: (receiverName: string) => void;
}

function UpdateActions({ permissions, alertManagerName, receiverName, onClickDeleteReceiver }: UpdateActionProps) {
  return (
    <>
      <Authorize actions={[permissions.update]}>
        <ActionIcon
          aria-label="Edit"
          data-testid="edit"
          to={makeAMLink(
            `/alerting/notifications/receivers/${encodeURIComponent(receiverName)}/edit`,
            alertManagerName
          )}
          tooltip="Edit contact point"
          icon="pen"
        />
      </Authorize>
      <Authorize actions={[permissions.delete]}>
        <ActionIcon
          onClick={() => onClickDeleteReceiver(receiverName)}
          tooltip="Delete contact point"
          icon="trash-alt"
        />
      </Authorize>
    </>
  );
}
interface ActionProps {
  permissions: {
    read: AccessControlAction;
    create: AccessControlAction;
    update: AccessControlAction;
    delete: AccessControlAction;
  };
  alertManagerName: string;
  receiverName: string;
}

function ViewAction({ permissions, alertManagerName, receiverName }: ActionProps) {
  return (
    <Authorize actions={[permissions.update]}>
      <ActionIcon
        data-testid="view"
        to={makeAMLink(`/alerting/notifications/receivers/${encodeURIComponent(receiverName)}/edit`, alertManagerName)}
        tooltip="View contact point"
        icon="file-alt"
      />
    </Authorize>
  );
}
interface ReceiverItem {
  name: string;
  types: string[]; //??
  provisioned?: boolean;
}

interface ReceiverErrorProps {
  errorCount: number;
}

type RowTableColumnProps = DynamicTableColumnProps<ReceiverItem>;
type RowItemTableProps = DynamicTableItemProps<ReceiverItem>;

function ReceiverError({ errorCount }: ReceiverErrorProps) {
  return (
    <Badge
      color="orange"
      icon="exclamation-triangle"
      text={`${errorCount} ${pluralize('error', errorCount)}`}
      tooltip={`${errorCount} ${pluralize('error', errorCount)} detected in this contact point`}
    />
  );
}
interface ReceiverHealthProps {
  errorsByReceiver: number;
}

function ReceiverHealth({ errorsByReceiver }: ReceiverHealthProps) {
  return errorsByReceiver > 0 ? (
    <ReceiverError errorCount={errorsByReceiver} />
  ) : (
    <Badge color="green" text="OK" tooltip="No errors detected" />
  );
}

interface Props {
  config: AlertManagerCortexConfig;
  alertManagerName: string;
}

const useContactPointsState = (alertManagerName: string) => {
  const contactPointsStateRequest = useUnifiedAlertingSelector((state) => state.contactPointsState);
  const { result: contactPointsState } = (alertManagerName && contactPointsStateRequest) || initialAsyncRequestState;
  const receivers: ReceiversState = contactPointsState?.receivers ?? {};
  const errorStateAvailable = Object.keys(receivers).length > 0; // this logic can change depending on how we implement this in the BE
  return { contactPointsState, errorStateAvailable };
};

export const ReceiversTable: FC<Props> = ({ config, alertManagerName }) => {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);
  const isVanillaAM = isVanillaPrometheusAlertManagerDataSource(alertManagerName);
  const permissions = getNotificationsPermissions(alertManagerName);
  const grafanaNotifiers = useUnifiedAlertingSelector((state) => state.grafanaNotifiers);

  const { contactPointsState, errorStateAvailable } = useContactPointsState(alertManagerName);

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

  const rows: RowItemTableProps[] = useMemo(
    () =>
      config.alertmanager_config.receivers?.map((receiver: Receiver) => ({
        id: receiver.id,
        data: {
          name: receiver.name,
          types: Object.entries(extractNotifierTypeCounts(receiver, grafanaNotifiers.result ?? [])).map(
            ([type, count]) => {
              if (count > 1) {
                return `${type} (${count})`;
              }
              return type;
            }
          ),
          provisioned: receiver.grafana_managed_receiver_configs?.some((receiver) => receiver.provenance),
        },
      })) ?? [],
    [config, grafanaNotifiers.result]
  );
  const columns = useGetColumns(
    alertManagerName,
    errorStateAvailable,
    contactPointsState,
    onClickDeleteReceiver,
    permissions,
    isVanillaAM
  );

  return (
    <ReceiversSection
      className={styles.section}
      title="Contact points"
      description="Define where the notifications will be sent to, for example email or Slack."
      showButton={!isVanillaAM && contextSrv.hasPermission(permissions.create)}
      addButtonLabel="New contact point"
      addButtonTo={makeAMLink('/alerting/notifications/receivers/new', alertManagerName)}
    >
      <DynamicTable
        items={rows}
        cols={columns}
        isExpandable={errorStateAvailable}
        renderExpandedContent={
          errorStateAvailable
            ? ({ data }) => (
                <div>
                  {data.name} - {data.types}
                </div>
              )
            : undefined
        }
      />
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

function useGetColumns(
  alertManagerName: string,
  errorStateAvailable: boolean,
  contactPointsState: ContactPointsState | undefined,
  onClickDeleteReceiver: (receiverName: string) => void,
  permissions: {
    read: AccessControlAction;
    create: AccessControlAction;
    update: AccessControlAction;
    delete: AccessControlAction;
  },
  isVanillaAM: boolean
): RowTableColumnProps[] {
  const tableStyles = useStyles2(getAlertTableStyles);
  const baseColumns: RowTableColumnProps[] = [
    {
      id: 'name',
      label: 'Contact point name',
      renderCell: ({ data: { name, provisioned } }) => (
        <>
          {name} {provisioned && <ProvisioningBadge />}
        </>
      ),
      size: 1,
    },
    {
      id: 'type',
      label: 'Type',
      renderCell: ({ data: { types } }) => <>{types.join(', ')}</>,
      size: 1,
    },
  ];
  const healthColumn: RowTableColumnProps = {
    id: 'health',
    label: 'Health',
    renderCell: ({ data: { name } }) => {
      const errorsByReceiver = (contactPointsState: ContactPointsState, receiverName: string) =>
        contactPointsState?.receivers[receiverName]?.errorCount ?? 0;
      return contactPointsState && <ReceiverHealth errorsByReceiver={errorsByReceiver(contactPointsState, name)} />;
    },
    size: 1,
  };

  return [
    ...baseColumns,
    ...(errorStateAvailable ? [healthColumn] : []),
    {
      id: 'actions',
      label: 'Actions',
      renderCell: ({ data: { provisioned, name } }) => (
        <Authorize actions={[permissions.update, permissions.delete]}>
          <div className={tableStyles.actionsCell}>
            {!isVanillaAM && !provisioned && (
              <UpdateActions
                permissions={permissions}
                alertManagerName={alertManagerName}
                receiverName={name}
                onClickDeleteReceiver={onClickDeleteReceiver}
              />
            )}
            {(isVanillaAM || provisioned) && (
              <ViewAction permissions={permissions} alertManagerName={alertManagerName} receiverName={name} />
            )}
          </div>
        </Authorize>
      ),
      size: '100px',
    },
  ];
}

const getStyles = (theme: GrafanaTheme2) => ({
  section: css`
    margin-top: ${theme.spacing(4)};
  `,
  warning: css`
    color: ${theme.colors.warning.text};
  `,
  countMessage: css``,
});
