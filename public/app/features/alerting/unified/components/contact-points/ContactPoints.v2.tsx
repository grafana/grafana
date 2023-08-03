import { css } from '@emotion/css';
import { SerializedError } from '@reduxjs/toolkit';
import { uniqueId, upperFirst } from 'lodash';
import React, { ReactNode } from 'react';

import { dateTime, GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Alert, Button, Dropdown, Icon, LoadingPlaceholder, Menu, Tooltip, useStyles2 } from '@grafana/ui';
import { Text } from '@grafana/ui/src/unstable';
import ConditionalWrap from 'app/features/alerting/components/ConditionalWrap';
import { receiverTypeNames } from 'app/plugins/datasource/alertmanager/consts';
import { GrafanaNotifierType, NotifierStatus } from 'app/types/alerting';

import { useAlertmanager } from '../../state/AlertmanagerContext';
import { INTEGRATION_ICONS } from '../../types/contact-points';
import { MetaText } from '../MetaText';
import { ProvisioningBadge } from '../Provisioning';
import { Spacer } from '../Spacer';
import { Strong } from '../Strong';

import { useDeleteContactPointModal } from './Modals';
import { RECEIVER_STATUS_KEY, useContactPointsWithStatus, useDeleteContactPoint } from './useContactPoints';
import { getReceiverDescription, isProvisioned, ReceiverConfigWithStatus } from './utils';

const ContactPoints = () => {
  const { selectedAlertmanager } = useAlertmanager();
  const { isLoading, error, contactPoints } = useContactPointsWithStatus(selectedAlertmanager!);
  const { deleteTrigger, updateAlertmanagerState } = useDeleteContactPoint(selectedAlertmanager!);

  const [DeleteModal, showDeleteModal] = useDeleteContactPointModal(deleteTrigger, updateAlertmanagerState.isLoading);

  if (error) {
    // TODO fix this type casting, when error comes from "getContactPointsStatus" it probably won't be a SerializedError
    return <Alert title="Failed to fetch contact points">{(error as SerializedError).message}</Alert>;
  }

  if (isLoading) {
    return <LoadingPlaceholder text={'Loading...'} />;
  }

  return (
    <>
      <Stack direction="column">
        {contactPoints.map((contactPoint) => {
          const contactPointKey = selectedAlertmanager + contactPoint.name;
          const provisioned = isProvisioned(contactPoint);
          const disabled = updateAlertmanagerState.isLoading;

          return (
            <ContactPoint
              key={contactPointKey}
              name={contactPoint.name}
              disabled={disabled}
              onDelete={showDeleteModal}
              receivers={contactPoint.grafana_managed_receiver_configs}
              provisioned={provisioned}
            />
          );
        })}
      </Stack>
      {DeleteModal}
    </>
  );
};

interface ContactPointProps {
  name: string;
  disabled?: boolean;
  provisioned?: boolean;
  receivers: ReceiverConfigWithStatus[];
  onDelete: (name: string) => void;
}

export const ContactPoint = ({
  name,
  disabled = false,
  provisioned = false,
  receivers,
  onDelete,
}: ContactPointProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.contactPointWrapper} data-testid="contact-point">
      <Stack direction="column" gap={0}>
        <ContactPointHeader
          name={name}
          policies={[]}
          provisioned={provisioned}
          disabled={disabled}
          onDelete={onDelete}
        />
        <div className={styles.receiversWrapper}>
          {receivers?.map((receiver) => {
            const diagnostics = receiver[RECEIVER_STATUS_KEY];
            const sendingResolved = !Boolean(receiver.disableResolveMessage);

            return (
              <ContactPointReceiver
                key={uniqueId()}
                type={receiver.type}
                description={getReceiverDescription(receiver)}
                diagnostics={diagnostics}
                sendingResolved={sendingResolved}
              />
            );
          })}
        </div>
      </Stack>
    </div>
  );
};

interface ContactPointHeaderProps {
  name: string;
  disabled?: boolean;
  provisioned?: boolean;
  policies?: string[]; // some array of policies that refer to this contact point
  onDelete: (name: string) => void;
}

const ContactPointHeader = (props: ContactPointHeaderProps) => {
  const { name, disabled = false, provisioned = false, policies = [], onDelete } = props;
  const styles = useStyles2(getStyles);

  const disableActions = disabled || provisioned;

  return (
    <div className={styles.headerWrapper}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Stack alignItems="center" gap={1}>
          <Text variant="body">{name}</Text>
        </Stack>
        {policies.length > 0 ? (
          <MetaText>
            {/* TODO make this a link to the notification policies page with the filter applied */}
            is used by <Strong>{policies.length}</Strong> notification policies
          </MetaText>
        ) : (
          <MetaText>is not used in any policy</MetaText>
        )}
        {provisioned && <ProvisioningBadge />}
        <Spacer />
        <ConditionalWrap
          shouldWrap={provisioned}
          wrap={(children) => (
            <Tooltip content="Provisioned items cannot be edited in the UI" placement="top">
              {children}
            </Tooltip>
          )}
        >
          <Button
            variant="secondary"
            size="sm"
            icon="edit"
            type="button"
            disabled={disableActions}
            aria-label="edit-action"
            data-testid="edit-action"
          >
            Edit
          </Button>
        </ConditionalWrap>
        <Dropdown
          overlay={
            <Menu>
              <Menu.Item label="Export" icon="download-alt" />
              <Menu.Divider />
              <Menu.Item
                label="Delete"
                icon="trash-alt"
                destructive
                disabled={disableActions}
                onClick={() => onDelete(name)}
              />
            </Menu>
          }
        >
          <Button
            variant="secondary"
            size="sm"
            icon="ellipsis-h"
            type="button"
            aria-label="more-actions"
            data-testid="more-actions"
            disabled={disableActions}
          />
        </Dropdown>
      </Stack>
    </div>
  );
};

interface ContactPointReceiverProps {
  type: GrafanaNotifierType | string;
  description?: ReactNode;
  sendingResolved?: boolean;
  diagnostics?: NotifierStatus;
}

const ContactPointReceiver = (props: ContactPointReceiverProps) => {
  const { type, description, diagnostics, sendingResolved = true } = props;
  const styles = useStyles2(getStyles);

  const iconName = INTEGRATION_ICONS[type];
  const hasMetadata = diagnostics !== undefined;
  // TODO get the actual name of the type from /ngalert if grafanaManaged AM
  const receiverName = receiverTypeNames[type] ?? upperFirst(type);

  return (
    <div className={styles.integrationWrapper}>
      <Stack direction="column" gap={0}>
        <div className={styles.receiverDescriptionRow}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Stack direction="row" alignItems="center" gap={0.5}>
              {iconName && <Icon name={iconName} />}
              <Text variant="body" color="primary">
                {receiverName}
              </Text>
            </Stack>
            {description && (
              <Text variant="bodySmall" color="secondary">
                {description}
              </Text>
            )}
          </Stack>
        </div>
        {hasMetadata && <ContactPointReceiverMetadataRow diagnostics={diagnostics} sendingResolved={sendingResolved} />}
      </Stack>
    </div>
  );
};

interface ContactPointReceiverMetadata {
  sendingResolved: boolean;
  diagnostics: NotifierStatus;
}

const ContactPointReceiverMetadataRow = (props: ContactPointReceiverMetadata) => {
  const { diagnostics, sendingResolved } = props;
  const styles = useStyles2(getStyles);

  const failedToSend = Boolean(diagnostics.lastNotifyAttemptError);
  const lastDeliveryAttempt = dateTime(diagnostics.lastNotifyAttempt);
  const lastDeliveryAttemptDuration = diagnostics.lastNotifyAttemptDuration;
  const hasDeliveryAttempt = lastDeliveryAttempt.isValid();

  return (
    <div className={styles.metadataRow}>
      <Stack direction="row" gap={1}>
        {/* this is shown when the last delivery failed – we don't show any additional metadata */}
        {failedToSend ? (
          <>
            {/* TODO we might need an error variant for MetaText, dito for success */}
            <Text color="error" variant="bodySmall" weight="bold">
              <Stack direction="row" alignItems={'center'} gap={0.5}>
                <Tooltip content={diagnostics.lastNotifyAttemptError!}>
                  <span>
                    <Icon name="exclamation-circle" /> Last delivery attempt failed
                  </span>
                </Tooltip>
              </Stack>
            </Text>
          </>
        ) : (
          <>
            {/* this is shown when we have a last delivery attempt */}
            {hasDeliveryAttempt && (
              <>
                <MetaText icon="clock-nine">
                  Last delivery attempt{' '}
                  <Tooltip content={lastDeliveryAttempt.toLocaleString()}>
                    <span>
                      <Strong>{lastDeliveryAttempt.locale('en').fromNow()}</Strong>
                    </span>
                  </Tooltip>
                </MetaText>
                <MetaText icon="stopwatch">
                  took <Strong>{lastDeliveryAttemptDuration}</Strong>
                </MetaText>
              </>
            )}
            {/* when we have no last delivery attempt */}
            {!hasDeliveryAttempt && <MetaText icon="clock-nine">No delivery attempts</MetaText>}
            {/* this is only shown for contact points that only want "firing" updates */}
            {!sendingResolved && (
              <MetaText icon="info-circle">
                Delivering <Strong>only firing</Strong> notifications
              </MetaText>
            )}
          </>
        )}
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  contactPointWrapper: css`
    border-radius: ${theme.shape.borderRadius()};
    border: solid 1px ${theme.colors.border.weak};
    border-bottom: none;
  `,
  integrationWrapper: css`
    position: relative;
    background: ${theme.colors.background.primary};

    border-bottom: solid 1px ${theme.colors.border.weak};
  `,
  headerWrapper: css`
    padding: ${theme.spacing(1)} ${theme.spacing(1.5)};

    background: ${theme.colors.background.secondary};

    border-bottom: solid 1px ${theme.colors.border.weak};
    border-top-left-radius: ${theme.shape.borderRadius()};
    border-top-right-radius: ${theme.shape.borderRadius()};
  `,
  receiverDescriptionRow: css`
    padding: ${theme.spacing(1)} ${theme.spacing(1.5)};
  `,
  metadataRow: css`
    padding: 0 ${theme.spacing(1.5)} ${theme.spacing(1.5)} ${theme.spacing(1.5)};

    border-bottom-left-radius: ${theme.shape.borderRadius()};
    border-bottom-right-radius: ${theme.shape.borderRadius()};
  `,
  receiversWrapper: css``,
});

export default ContactPoints;
