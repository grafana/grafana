import { css } from '@emotion/css';
import { SerializedError } from '@reduxjs/toolkit';
import { groupBy, size, uniqueId, upperFirst } from 'lodash';
import pluralize from 'pluralize';
import React, { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';

import { dateTime, GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import {
  Alert,
  Button,
  Dropdown,
  Icon,
  LoadingPlaceholder,
  Menu,
  Tooltip,
  useStyles2,
  Text,
  LinkButton,
  TabsBar,
  TabContent,
  Tab,
} from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import ConditionalWrap from 'app/features/alerting/components/ConditionalWrap';
import { isOrgAdmin } from 'app/features/plugins/admin/permissions';
import { receiverTypeNames } from 'app/plugins/datasource/alertmanager/consts';
import { GrafanaManagedReceiverConfig } from 'app/plugins/datasource/alertmanager/types';
import { GrafanaNotifierType, NotifierStatus } from 'app/types/alerting';

import { useAlertmanager } from '../../state/AlertmanagerContext';
import { INTEGRATION_ICONS } from '../../types/contact-points';
import { getNotificationsPermissions } from '../../utils/access-control';
import { GRAFANA_RULES_SOURCE_NAME, isVanillaPrometheusAlertManagerDataSource } from '../../utils/datasource';
import { createUrl } from '../../utils/url';
import { MetaText } from '../MetaText';
import { ProvisioningBadge } from '../Provisioning';
import { Spacer } from '../Spacer';
import { Strong } from '../Strong';
import { GlobalConfigAlert } from '../receivers/ReceiversAndTemplatesView';
import { UnusedContactPointBadge } from '../receivers/ReceiversTable';

import { MessageTemplates } from './MessageTemplates';
import { useDeleteContactPointModal } from './Modals';
import { RECEIVER_STATUS_KEY, useContactPointsWithStatus, useDeleteContactPoint } from './useContactPoints';
import { getReceiverDescription, isProvisioned, ReceiverConfigWithStatus } from './utils';

enum ActiveTab {
  ContactPoints,
  MessageTemplates,
}

const ContactPoints = () => {
  const { selectedAlertmanager } = useAlertmanager();
  // TODO hook up to query params
  const [activeTab, setActiveTab] = useState<ActiveTab>(ActiveTab.ContactPoints);
  const { isLoading, error, contactPoints } = useContactPointsWithStatus(selectedAlertmanager!);
  const { deleteTrigger, updateAlertmanagerState } = useDeleteContactPoint(selectedAlertmanager!);

  const [DeleteModal, showDeleteModal] = useDeleteContactPointModal(deleteTrigger, updateAlertmanagerState.isLoading);

  const showingContactPoints = activeTab === ActiveTab.ContactPoints;
  const showingMessageTemplates = activeTab === ActiveTab.MessageTemplates;

  if (error) {
    // TODO fix this type casting, when error comes from "getContactPointsStatus" it probably won't be a SerializedError
    return <Alert title="Failed to fetch contact points">{(error as SerializedError).message}</Alert>;
  }

  const isGrafanaManagedAlertmanager = selectedAlertmanager === GRAFANA_RULES_SOURCE_NAME;
  const isVanillaAlertmanager = isVanillaPrometheusAlertManagerDataSource(selectedAlertmanager!);
  const permissions = getNotificationsPermissions(selectedAlertmanager!);

  const allowedToAddContactPoint = contextSrv.hasPermission(permissions.create);

  return (
    <>
      <Stack direction="column">
        <TabsBar>
          <Tab
            label="Contact Points"
            active={showingContactPoints}
            counter={contactPoints.length}
            onChangeTab={() => setActiveTab(ActiveTab.ContactPoints)}
          />
          <Tab
            label="Message Templates"
            active={showingMessageTemplates}
            onChangeTab={() => setActiveTab(ActiveTab.MessageTemplates)}
          />
          <Spacer />
          {showingContactPoints && (
            <LinkButton
              icon="plus"
              variant="primary"
              href="/alerting/notifications/receivers/new"
              // TODO clarify why the button has been disabled
              disabled={!allowedToAddContactPoint || isVanillaAlertmanager}
            >
              Add contact point
            </LinkButton>
          )}
          {showingMessageTemplates && (
            <LinkButton icon="plus" variant="primary" href="/alerting/notifications/templates/new">
              Add message template
            </LinkButton>
          )}
        </TabsBar>
        <TabContent>
          <Stack direction="column">
            <>
              {isLoading && <LoadingPlaceholder text={'Loading...'} />}
              {/* Contact Points tab */}
              {showingContactPoints && (
                <>
                  {error ? (
                    <Alert title="Failed to fetch contact points">{String(error)}</Alert>
                  ) : (
                    <>
                      {/* TODO we can add some additional info here with a ToggleTip */}
                      <Text variant="body" color="secondary">
                        Define where notifications are sent, a contact point can contain multiple integrations.
                      </Text>
                      {contactPoints.map((contactPoint) => {
                        const contactPointKey = selectedAlertmanager + contactPoint.name;
                        const provisioned = isProvisioned(contactPoint);
                        const disabled = updateAlertmanagerState.isLoading;
                        const policies = contactPoint.numberOfPolicies;

                        return (
                          <ContactPoint
                            key={contactPointKey}
                            name={contactPoint.name}
                            disabled={disabled}
                            onDelete={(name) => showDeleteModal(name)}
                            receivers={contactPoint.grafana_managed_receiver_configs}
                            provisioned={provisioned}
                            policies={policies}
                          />
                        );
                      })}
                      {/* Grafana manager Alertmanager does not support global config, Mimir and Cortex do */}
                      {!isGrafanaManagedAlertmanager && <GlobalConfigAlert alertManagerName={selectedAlertmanager!} />}
                    </>
                  )}
                </>
              )}
              {/* Message Templates tab */}
              {showingMessageTemplates && (
                <>
                  <Text variant="body" color="secondary">
                    Create message templates to customize your notifications.
                  </Text>
                  <MessageTemplates />
                </>
              )}
            </>
          </Stack>
        </TabContent>
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
  policies?: number;
  onDelete: (name: string) => void;
}

export const ContactPoint = ({
  name,
  disabled = false,
  provisioned = false,
  receivers,
  policies = 0,
  onDelete,
}: ContactPointProps) => {
  const styles = useStyles2(getStyles);

  // TODO probably not the best way to figure out if we want to show either only the summary or full metadata for the receivers?
  const showFullMetadata = receivers.some((receiver) => Boolean(receiver[RECEIVER_STATUS_KEY]));

  return (
    <div className={styles.contactPointWrapper} data-testid="contact-point">
      <Stack direction="column" gap={0}>
        <ContactPointHeader
          name={name}
          policies={policies}
          provisioned={provisioned}
          disabled={disabled}
          onDelete={onDelete}
        />
        {showFullMetadata ? (
          <div>
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
        ) : (
          <div>
            <ContactPointReceiverSummary receivers={receivers} />
          </div>
        )}
      </Stack>
    </div>
  );
};

interface ContactPointHeaderProps {
  name: string;
  disabled?: boolean;
  provisioned?: boolean;
  policies?: number;
  onDelete: (name: string) => void;
}

const ContactPointHeader = (props: ContactPointHeaderProps) => {
  const { name, disabled = false, provisioned = false, policies = 0, onDelete } = props;
  const styles = useStyles2(getStyles);
  const { selectedAlertmanager } = useAlertmanager();
  const permissions = getNotificationsPermissions(selectedAlertmanager ?? '');

  const isReferencedByPolicies = policies > 0;
  const isGranaManagedAlertmanager = selectedAlertmanager === GRAFANA_RULES_SOURCE_NAME;

  // we make a distinction here becase for "canExport" we show the menu item, if not we hide it
  const canExport = isGranaManagedAlertmanager;
  const allowedToExport = contextSrv.hasAccess(permissions.provisioning.read, isOrgAdmin());

  return (
    <div className={styles.headerWrapper}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Stack alignItems="center" gap={1}>
          <Text variant="body" weight="medium">
            {name}
          </Text>
        </Stack>
        {isReferencedByPolicies ? (
          <MetaText>
            <Link to={createUrl('/alerting/routes', { contactPoint: name })}>
              is used by <Strong>{policies}</Strong> {pluralize('notification policy', policies)}
            </Link>
          </MetaText>
        ) : (
          <UnusedContactPointBadge />
        )}
        {provisioned && <ProvisioningBadge />}
        <Spacer />
        <LinkButton
          tooltipPlacement="top"
          tooltip={provisioned ? 'Provisioned contact points cannot be edited in the UI' : undefined}
          variant="secondary"
          size="sm"
          icon={provisioned ? 'document-info' : 'edit'}
          type="button"
          disabled={disabled}
          aria-label={`${provisioned ? 'view' : 'edit'}-action`}
          data-testid={`${provisioned ? 'view' : 'edit'}-action`}
          href={`/alerting/notifications/receivers/${encodeURIComponent(name)}/edit`}
        >
          {provisioned ? 'View' : 'Edit'}
        </LinkButton>
        {/* TODO probably want to split this off since there's lots of RBAC involved here */}
        <Dropdown
          overlay={
            <Menu>
              {canExport && (
                <>
                  <Menu.Item
                    icon="download-alt"
                    label={isOrgAdmin() ? 'Export' : 'Export redacted'}
                    disabled={!allowedToExport}
                    url={createUrl(`/api/v1/provisioning/contact-points/export/`, {
                      download: 'true',
                      format: 'yaml',
                      decrypt: isOrgAdmin().toString(),
                      name: name,
                    })}
                    target="_blank"
                    data-testid="export"
                  />
                  <Menu.Divider />
                </>
              )}
              <ConditionalWrap
                shouldWrap={policies > 0}
                wrap={(children) => (
                  <Tooltip
                    content={'Contact point is currently in use by one or more notification policies'}
                    placement="top"
                  >
                    <span>{children}</span>
                  </Tooltip>
                )}
              >
                <Menu.Item
                  label="Delete"
                  icon="trash-alt"
                  destructive
                  disabled={disabled || provisioned || policies > 0}
                  onClick={() => onDelete(name)}
                />
              </ConditionalWrap>
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
      <Stack direction="column" gap={0.5}>
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
        {hasMetadata && <ContactPointReceiverMetadataRow diagnostics={diagnostics} sendingResolved={sendingResolved} />}
      </Stack>
    </div>
  );
};

interface ContactPointReceiverMetadata {
  sendingResolved: boolean;
  diagnostics: NotifierStatus;
}

type ContactPointReceiverSummaryProps = {
  receivers: GrafanaManagedReceiverConfig[];
};

/**
 * This summary is used when we're dealing with non-Grafana managed alertmanager since they
 * don't have any metadata worth showing other than a summary of what types are configured for the contact point
 */
const ContactPointReceiverSummary = ({ receivers }: ContactPointReceiverSummaryProps) => {
  const styles = useStyles2(getStyles);
  const countByType = groupBy(receivers, (receiver) => receiver.type);

  return (
    <div className={styles.integrationWrapper}>
      <Stack direction="column" gap={0}>
        <Stack direction="row" alignItems="center" gap={1}>
          {Object.entries(countByType).map(([type, receivers], index) => {
            const iconName = INTEGRATION_ICONS[type];
            const receiverName = receiverTypeNames[type] ?? upperFirst(type);
            const isLastItem = size(countByType) - 1 === index;

            return (
              <React.Fragment key={type}>
                <Stack direction="row" alignItems="center" gap={0.5}>
                  {iconName && <Icon name={iconName} />}
                  <Text variant="body" color="primary">
                    {receiverName}
                    {receivers.length > 1 && <> ({receivers.length})</>}
                  </Text>
                </Stack>
                {!isLastItem && '⋅'}
              </React.Fragment>
            );
          })}
        </Stack>
      </Stack>
    </div>
  );
};

const ContactPointReceiverMetadataRow = ({ diagnostics, sendingResolved }: ContactPointReceiverMetadata) => {
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
            <MetaText color="error" icon="exclamation-circle">
              <Tooltip content={diagnostics.lastNotifyAttemptError!}>
                <span>Last delivery attempt failed</span>
              </Tooltip>
            </MetaText>
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
    border-radius: ${theme.shape.radius.default};
    border: solid 1px ${theme.colors.border.weak};
    border-bottom: none;
  `,
  integrationWrapper: css`
    position: relative;

    background: ${theme.colors.background.primary};
    padding: ${theme.spacing(1)} ${theme.spacing(1.5)};

    border-bottom: solid 1px ${theme.colors.border.weak};
  `,
  headerWrapper: css`
    background: ${theme.colors.background.secondary};
    padding: ${theme.spacing(1)} ${theme.spacing(1.5)};

    border-bottom: solid 1px ${theme.colors.border.weak};
    border-top-left-radius: ${theme.shape.radius.default};
    border-top-right-radius: ${theme.shape.radius.default};
  `,
  metadataRow: css`
    border-bottom-left-radius: ${theme.shape.radius.default};
    border-bottom-right-radius: ${theme.shape.radius.default};
  `,
});

export default ContactPoints;
