import { css } from '@emotion/css';
import uFuzzy from '@leeoniya/ufuzzy';
import { SerializedError } from '@reduxjs/toolkit';
import { groupBy, size, uniq, upperFirst } from 'lodash';
import pluralize from 'pluralize';
import React, { Fragment, ReactNode, useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToggle } from 'react-use';

import { dateTime, GrafanaTheme2 } from '@grafana/data';
import {
  Alert,
  Button,
  Dropdown,
  Icon,
  LinkButton,
  LoadingPlaceholder,
  Menu,
  Pagination,
  Stack,
  Tab,
  TabContent,
  TabsBar,
  Text,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
import ConditionalWrap from 'app/features/alerting/components/ConditionalWrap';
import { receiverTypeNames } from 'app/plugins/datasource/alertmanager/consts';
import { GrafanaManagedReceiverConfig } from 'app/plugins/datasource/alertmanager/types';
import { GrafanaNotifierType, NotifierStatus } from 'app/types/alerting';

import { AlertmanagerAction, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { usePagination } from '../../hooks/usePagination';
import { useURLSearchParams } from '../../hooks/useURLSearchParams';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { INTEGRATION_ICONS } from '../../types/contact-points';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { createUrl } from '../../utils/url';
import { GrafanaAlertmanagerDeliveryWarning } from '../GrafanaAlertmanagerDeliveryWarning';
import { MetaText } from '../MetaText';
import MoreButton from '../MoreButton';
import { ProvisioningBadge } from '../Provisioning';
import { Spacer } from '../Spacer';
import { Strong } from '../Strong';
import { GrafanaReceiverExporter } from '../export/GrafanaReceiverExporter';
import { GrafanaReceiversExporter } from '../export/GrafanaReceiversExporter';
import { ReceiverMetadataBadge } from '../receivers/grafanaAppReceivers/ReceiverMetadataBadge';
import { ReceiverPluginMetadata } from '../receivers/grafanaAppReceivers/useReceiversMetadata';

import { NotificationTemplates } from './NotificationTemplates';
import { ContactPointsFilter } from './components/ContactPointsFilter';
import { GlobalConfigAlert } from './components/GlobalConfigAlert';
import { useDeleteContactPointModal } from './components/Modals';
import { UnusedContactPointBadge } from './components/UnusedBadge';
import {
  RECEIVER_META_KEY,
  RECEIVER_PLUGIN_META_KEY,
  RECEIVER_STATUS_KEY,
  useContactPointsWithStatus,
  useDeleteContactPoint,
} from './useContactPoints';
import { ContactPointWithMetadata, getReceiverDescription, isProvisioned, ReceiverConfigWithMetadata } from './utils';

enum ActiveTab {
  ContactPoints,
  NotificationTemplates,
}

const DEFAULT_PAGE_SIZE = 10;

const ContactPoints = () => {
  const { selectedAlertmanager } = useAlertmanager();
  // TODO hook up to query params
  const [activeTab, setActiveTab] = useState<ActiveTab>(ActiveTab.ContactPoints);
  let { isLoading, error, contactPoints } = useContactPointsWithStatus();
  const { deleteTrigger, updateAlertmanagerState } = useDeleteContactPoint(selectedAlertmanager!);
  const [addContactPointSupported, addContactPointAllowed] = useAlertmanagerAbility(
    AlertmanagerAction.CreateContactPoint
  );
  const [exportContactPointsSupported, exportContactPointsAllowed] = useAlertmanagerAbility(
    AlertmanagerAction.ExportContactPoint
  );

  const [DeleteModal, showDeleteModal] = useDeleteContactPointModal(deleteTrigger, updateAlertmanagerState.isLoading);
  const [ExportDrawer, showExportDrawer] = useExportContactPoint();

  const [searchParams] = useURLSearchParams();
  const { search } = getContactPointsFilters(searchParams);

  const showingContactPoints = activeTab === ActiveTab.ContactPoints;
  const showNotificationTemplates = activeTab === ActiveTab.NotificationTemplates;

  if (error) {
    // TODO fix this type casting, when error comes from "getContactPointsStatus" it probably won't be a SerializedError
    return <Alert title="Failed to fetch contact points">{(error as SerializedError).message}</Alert>;
  }

  const isGrafanaManagedAlertmanager = selectedAlertmanager === GRAFANA_RULES_SOURCE_NAME;

  return (
    <>
      <GrafanaAlertmanagerDeliveryWarning currentAlertmanager={selectedAlertmanager!} />

      <Stack direction="column">
        <TabsBar>
          <Tab
            label="Contact Points"
            active={showingContactPoints}
            counter={contactPoints.length}
            onChangeTab={() => setActiveTab(ActiveTab.ContactPoints)}
          />
          <Tab
            label="Notification Templates"
            active={showNotificationTemplates}
            onChangeTab={() => setActiveTab(ActiveTab.NotificationTemplates)}
          />
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
                      <Stack direction="row" alignItems="end">
                        <ContactPointsFilter />
                        <Spacer />
                        <Stack direction="row" gap={1}>
                          {addContactPointSupported && (
                            <LinkButton
                              icon="plus"
                              aria-label="add contact point"
                              variant="primary"
                              href="/alerting/notifications/receivers/new"
                              disabled={!addContactPointAllowed}
                            >
                              Add contact point
                            </LinkButton>
                          )}
                          {exportContactPointsSupported && (
                            <Button
                              icon="download-alt"
                              variant="secondary"
                              aria-label="export all"
                              disabled={!exportContactPointsAllowed}
                              onClick={() => showExportDrawer(ALL_CONTACT_POINTS)}
                            >
                              Export all
                            </Button>
                          )}
                        </Stack>
                      </Stack>
                      <ContactPointsList
                        contactPoints={contactPoints}
                        search={search}
                        pageSize={DEFAULT_PAGE_SIZE}
                        onDelete={(name) => showDeleteModal(name)}
                        disabled={updateAlertmanagerState.isLoading}
                      />
                      {/* Grafana manager Alertmanager does not support global config, Mimir and Cortex do */}
                      {!isGrafanaManagedAlertmanager && <GlobalConfigAlert alertManagerName={selectedAlertmanager!} />}
                    </>
                  )}
                </>
              )}
              {/* Notification Templates tab */}
              {showNotificationTemplates && (
                <>
                  <Stack direction="row" alignItems="center">
                    <Text variant="body" color="secondary">
                      Create notification templates to customize your notifications.
                    </Text>
                    <Spacer />
                    <LinkButton icon="plus" variant="primary" href="/alerting/notifications/templates/new">
                      Add notification template
                    </LinkButton>
                  </Stack>
                  <NotificationTemplates />
                </>
              )}
            </>
          </Stack>
        </TabContent>
      </Stack>
      {DeleteModal}
      {ExportDrawer}
    </>
  );
};

interface ContactPointsListProps {
  contactPoints: ContactPointWithMetadata[];
  search?: string;
  disabled?: boolean;
  onDelete: (name: string) => void;
  pageSize?: number;
}

const ContactPointsList = ({
  contactPoints,
  disabled = false,
  search,
  pageSize = DEFAULT_PAGE_SIZE,
  onDelete,
}: ContactPointsListProps) => {
  const searchResults = useContactPointsSearch(contactPoints, search);
  const { page, pageItems, numberOfPages, onPageChange } = usePagination(searchResults, 1, pageSize);

  return (
    <>
      {pageItems.map((contactPoint, index) => {
        const provisioned = isProvisioned(contactPoint);
        const policies = contactPoint.numberOfPolicies;
        const key = `${contactPoint.name}-${index}`;

        return (
          <ContactPoint
            key={key}
            name={contactPoint.name}
            disabled={disabled}
            onDelete={onDelete}
            receivers={contactPoint.grafana_managed_receiver_configs}
            provisioned={provisioned}
            policies={policies}
          />
        );
      })}
      <Pagination currentPage={page} numberOfPages={numberOfPages} onNavigate={onPageChange} hideWhenSinglePage />
    </>
  );
};

const fuzzyFinder = new uFuzzy({
  intraMode: 1,
  intraIns: 1,
  intraSub: 1,
  intraDel: 1,
  intraTrn: 1,
});

// let's search in two different haystacks, the name of the contact point and the type of the receiver(s)
function useContactPointsSearch(
  contactPoints: ContactPointWithMetadata[],
  search?: string
): ContactPointWithMetadata[] {
  const nameHaystack = useMemo(() => {
    return contactPoints.map((contactPoint) => contactPoint.name);
  }, [contactPoints]);

  const typeHaystack = useMemo(() => {
    return contactPoints.map((contactPoint) =>
      // we're using the resolved metadata key here instead of the "type" property – ex. we alias "teams" to "microsoft teams"
      contactPoint.grafana_managed_receiver_configs.map((receiver) => receiver[RECEIVER_META_KEY].name).join(' ')
    );
  }, [contactPoints]);

  if (!search) {
    return contactPoints;
  }

  const nameHits = fuzzyFinder.filter(nameHaystack, search) ?? [];
  const typeHits = fuzzyFinder.filter(typeHaystack, search) ?? [];

  const hits = [...nameHits, ...typeHits];

  return uniq(hits).map((id) => contactPoints[id]) ?? [];
}

interface ContactPointProps {
  name: string;
  disabled?: boolean;
  provisioned?: boolean;
  receivers: ReceiverConfigWithMetadata[];
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
            {receivers.map((receiver, index) => {
              const diagnostics = receiver[RECEIVER_STATUS_KEY];
              const metadata = receiver[RECEIVER_META_KEY];
              const sendingResolved = !Boolean(receiver.disableResolveMessage);
              const pluginMetadata = receiver[RECEIVER_PLUGIN_META_KEY];
              const key = metadata.name + index;

              return (
                <ContactPointReceiver
                  key={key}
                  name={metadata.name}
                  type={receiver.type}
                  description={getReceiverDescription(receiver)}
                  diagnostics={diagnostics}
                  pluginMetadata={pluginMetadata}
                  sendingResolved={sendingResolved}
                />
              );
            })}
          </div>
        ) : (
          <div className={styles.integrationWrapper}>
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

  const [exportSupported, exportAllowed] = useAlertmanagerAbility(AlertmanagerAction.ExportContactPoint);
  const [editSupported, editAllowed] = useAlertmanagerAbility(AlertmanagerAction.UpdateContactPoint);
  const [deleteSupported, deleteAllowed] = useAlertmanagerAbility(AlertmanagerAction.UpdateContactPoint);

  const [ExportDrawer, openExportDrawer] = useExportContactPoint();

  const isReferencedByPolicies = policies > 0;
  const canEdit = editSupported && editAllowed && !provisioned;
  const canDelete = deleteSupported && deleteAllowed && !provisioned && policies === 0;

  const menuActions: JSX.Element[] = [];

  if (exportSupported) {
    menuActions.push(
      <Fragment key="export-contact-point">
        <Menu.Item
          icon="download-alt"
          label="Export"
          ariaLabel="export"
          disabled={!exportAllowed}
          data-testid="export"
          onClick={() => openExportDrawer(name)}
        />
        <Menu.Divider />
      </Fragment>
    );
  }

  if (deleteSupported) {
    menuActions.push(
      <ConditionalWrap
        key="delete-contact-point"
        shouldWrap={isReferencedByPolicies}
        wrap={(children) => (
          <Tooltip content="Contact point is currently in use by one or more notification policies" placement="top">
            <span>{children}</span>
          </Tooltip>
        )}
      >
        <Menu.Item
          label="Delete"
          ariaLabel="delete"
          icon="trash-alt"
          destructive
          disabled={disabled || !canDelete}
          onClick={() => onDelete(name)}
        />
      </ConditionalWrap>
    );
  }

  return (
    <div className={styles.headerWrapper}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Stack alignItems="center" gap={1}>
          <Text variant="body" weight="medium">
            {name}
          </Text>
        </Stack>
        {isReferencedByPolicies && (
          <MetaText>
            <Link to={createUrl('/alerting/routes', { contactPoint: name })}>
              is used by <Strong>{policies}</Strong> {pluralize('notification policy', policies)}
            </Link>
          </MetaText>
        )}
        {provisioned && <ProvisioningBadge />}
        {!isReferencedByPolicies && <UnusedContactPointBadge />}
        <Spacer />
        <LinkButton
          tooltipPlacement="top"
          tooltip={provisioned ? 'Provisioned contact points cannot be edited in the UI' : undefined}
          variant="secondary"
          size="sm"
          icon={canEdit ? 'pen' : 'eye'}
          type="button"
          disabled={disabled}
          aria-label={`${canEdit ? 'edit' : 'view'}-action`}
          data-testid={`${canEdit ? 'edit' : 'view'}-action`}
          href={`/alerting/notifications/receivers/${encodeURIComponent(name)}/edit`}
        >
          {canEdit ? 'Edit' : 'View'}
        </LinkButton>
        {menuActions.length > 0 && (
          <Dropdown overlay={<Menu>{menuActions}</Menu>}>
            <MoreButton />
          </Dropdown>
        )}
      </Stack>
      {ExportDrawer}
    </div>
  );
};

interface ContactPointReceiverProps {
  name: string;
  type: GrafanaNotifierType | string;
  description?: ReactNode;
  sendingResolved?: boolean;
  diagnostics?: NotifierStatus;
  pluginMetadata?: ReceiverPluginMetadata;
}

const ContactPointReceiver = (props: ContactPointReceiverProps) => {
  const { name, type, description, diagnostics, pluginMetadata, sendingResolved = true } = props;
  const styles = useStyles2(getStyles);

  const hasMetadata = diagnostics !== undefined;

  return (
    <div className={styles.integrationWrapper}>
      <Stack direction="column" gap={0.5}>
        <ContactPointReceiverTitleRow
          name={name}
          type={type}
          description={description}
          pluginMetadata={pluginMetadata}
        />
        {hasMetadata && <ContactPointReceiverMetadataRow diagnostics={diagnostics} sendingResolved={sendingResolved} />}
      </Stack>
    </div>
  );
};

export interface ContactPointReceiverTitleRowProps {
  name: string;
  type: GrafanaNotifierType | string;
  description?: ReactNode;
  pluginMetadata?: ReceiverPluginMetadata;
}

export function ContactPointReceiverTitleRow(props: ContactPointReceiverTitleRowProps) {
  const { name, type, description, pluginMetadata } = props;

  const iconName = INTEGRATION_ICONS[type];

  return (
    <Stack direction="row" alignItems="center" gap={1}>
      <Stack direction="row" alignItems="center" gap={0.5}>
        {iconName && <Icon name={iconName} />}
        {pluginMetadata ? (
          <ReceiverMetadataBadge metadata={pluginMetadata} />
        ) : (
          <Text variant="body" color="primary">
            {name}
          </Text>
        )}
      </Stack>
      {description && (
        <Text variant="bodySmall" color="secondary">
          {description}
        </Text>
      )}
    </Stack>
  );
}

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
export const ContactPointReceiverSummary = ({ receivers }: ContactPointReceiverSummaryProps) => {
  const countByType = groupBy(receivers, (receiver) => receiver.type);

  return (
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
                <Text variant="body">
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

const ALL_CONTACT_POINTS = Symbol('all contact points');

type ExportProps = [JSX.Element | null, (receiver: string | typeof ALL_CONTACT_POINTS) => void];

const useExportContactPoint = (): ExportProps => {
  const [receiverName, setReceiverName] = useState<string | typeof ALL_CONTACT_POINTS | null>(null);
  const [isExportDrawerOpen, toggleShowExportDrawer] = useToggle(false);
  const [decryptSecretsSupported, decryptSecretsAllowed] = useAlertmanagerAbility(AlertmanagerAction.DecryptSecrets);

  const canReadSecrets = decryptSecretsSupported && decryptSecretsAllowed;

  const handleClose = useCallback(() => {
    setReceiverName(null);
    toggleShowExportDrawer(false);
  }, [toggleShowExportDrawer]);

  const handleOpen = (receiverName: string | typeof ALL_CONTACT_POINTS) => {
    setReceiverName(receiverName);
    toggleShowExportDrawer(true);
  };

  const drawer = useMemo(() => {
    if (!receiverName || !isExportDrawerOpen) {
      return null;
    }

    if (receiverName === ALL_CONTACT_POINTS) {
      // use this drawer when we want to export all contact points
      return <GrafanaReceiversExporter decrypt={canReadSecrets} onClose={handleClose} />;
    } else {
      // use this one for exporting a single contact point
      return <GrafanaReceiverExporter receiverName={receiverName} decrypt={canReadSecrets} onClose={handleClose} />;
    }
  }, [canReadSecrets, isExportDrawerOpen, handleClose, receiverName]);

  return [drawer, handleOpen];
};

const getContactPointsFilters = (searchParams: URLSearchParams) => ({
  search: searchParams.get('search') ?? undefined,
});

const getStyles = (theme: GrafanaTheme2) => ({
  contactPointWrapper: css({
    borderRadius: `${theme.shape.radius.default}`,
    border: `solid 1px ${theme.colors.border.weak}`,
    borderBottom: 'none',
  }),
  integrationWrapper: css({
    position: 'relative',

    background: `${theme.colors.background.primary}`,
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,

    borderBottom: `solid 1px ${theme.colors.border.weak}`,
  }),
  headerWrapper: css({
    background: `${theme.colors.background.secondary}`,
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,

    borderBottom: `solid 1px ${theme.colors.border.weak}`,
    borderTopLeftRadius: `${theme.shape.radius.default}`,
    borderTopRightRadius: `${theme.shape.radius.default}`,
  }),
  metadataRow: css({
    borderBottomLeftRadius: `${theme.shape.radius.default}`,
    borderBottomRightRadius: `${theme.shape.radius.default}`,
  }),
});

export default ContactPoints;
