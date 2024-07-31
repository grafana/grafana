import { useMemo } from 'react';

import {
  Alert,
  Button,
  LinkButton,
  LoadingPlaceholder,
  Pagination,
  Stack,
  Tab,
  TabContent,
  TabsBar,
  Text,
} from '@grafana/ui';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';

import { AlertmanagerAction, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { usePagination } from '../../hooks/usePagination';
import { useURLSearchParams } from '../../hooks/useURLSearchParams';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { GrafanaAlertmanagerDeliveryWarning } from '../GrafanaAlertmanagerDeliveryWarning';

import { ContactPoint } from './ContactPoint';
import { NotificationTemplates } from './NotificationTemplates';
import { ContactPointsFilter } from './components/ContactPointsFilter';
import { GlobalConfigAlert } from './components/GlobalConfigAlert';
import { useDeleteContactPointModal } from './components/Modals';
import { useContactPointsWithStatus, useDeleteContactPoint } from './useContactPoints';
import { useContactPointsSearch } from './useContactPointsSearch';
import { ALL_CONTACT_POINTS, useExportContactPoint } from './useExportContactPoint';
import { ContactPointWithMetadata, isProvisioned } from './utils';

export enum ActiveTab {
  ContactPoints = 'contact_points',
  NotificationTemplates = 'templates',
}

const DEFAULT_PAGE_SIZE = 10;

const ContactPointsTab = () => {
  const { selectedAlertmanager } = useAlertmanager();
  const [queryParams] = useURLSearchParams();

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

  const search = queryParams.get('search');

  if (error) {
    // TODO fix this type casting, when error comes from "getContactPointsStatus" it probably won't be a SerializedError
    return <Alert title="Failed to fetch contact points">{stringifyErrorLike(error)}</Alert>;
  }

  if (isLoading) {
    return <LoadingPlaceholder text="Loading..." />;
  }

  const isGrafanaManagedAlertmanager = selectedAlertmanager === GRAFANA_RULES_SOURCE_NAME;
  return (
    <>
      {/* TODO we can add some additional info here with a ToggleTip */}
      <Stack direction="row" alignItems="end" justifyContent="space-between">
        <ContactPointsFilter />

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
      {DeleteModal}
      {ExportDrawer}
    </>
  );
};

const NotificationTemplatesTab = () => {
  const [createTemplateSupported, createTemplateAllowed] = useAlertmanagerAbility(
    AlertmanagerAction.CreateNotificationTemplate
  );

  return (
    <>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Text variant="body" color="secondary">
          Create notification templates to customize your notifications.
        </Text>
        {createTemplateSupported && (
          <LinkButton
            icon="plus"
            variant="primary"
            href="/alerting/notifications/templates/new"
            disabled={!createTemplateAllowed}
          >
            Add notification template
          </LinkButton>
        )}
      </Stack>
      <NotificationTemplates />
    </>
  );
};

const useTabQueryParam = () => {
  const [queryParams, setQueryParams] = useURLSearchParams();
  const param = useMemo(() => {
    const queryParam = queryParams.get('tab');

    if (!queryParam || !Object.values(ActiveTab).map(String).includes(queryParam)) {
      return ActiveTab.ContactPoints;
    }

    return queryParam || ActiveTab.ContactPoints;
  }, [queryParams]);

  const setParam = (tab: ActiveTab) => setQueryParams({ tab });

  return [param, setParam] as const;
};

const ContactPointsPageContents = () => {
  const { selectedAlertmanager } = useAlertmanager();
  const [activeTab, setActiveTab] = useTabQueryParam();

  let { contactPoints } = useContactPointsWithStatus();

  const showingContactPoints = activeTab === ActiveTab.ContactPoints;
  const showNotificationTemplates = activeTab === ActiveTab.NotificationTemplates;

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
            {showingContactPoints && <ContactPointsTab />}
            {showNotificationTemplates && <NotificationTemplatesTab />}
          </Stack>
        </TabContent>
      </Stack>
    </>
  );
};

interface ContactPointsListProps {
  contactPoints: ContactPointWithMetadata[];
  search?: string | null;
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
        const policies = contactPoint.policies ?? [];
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

export default ContactPointsPageContents;
