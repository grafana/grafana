import { css } from '@emotion/css';
import { Fragment, useState } from 'react';

import { GrafanaTheme2, UrlQueryMap } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  Alert,
  Button,
  Dropdown,
  EmptyState,
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
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { useMuteTimings } from 'app/features/alerting/unified/components/mute-timings/useMuteTimings';
import { NotificationPoliciesTree } from 'app/features/alerting/unified/components/notification-policies/NotificationPoliciesTree';
import { MetadataRow } from 'app/features/alerting/unified/components/notification-policies/Policy';
import {
  AlertmanagerAction,
  useAlertmanagerAbilities,
  useAlertmanagerAbility,
} from 'app/features/alerting/unified/hooks/useAbilities';

import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import { GrafanaAlertmanagerWarning } from './components/GrafanaAlertmanagerWarning';
import { TimeIntervalsTable } from './components/mute-timings/MuteTimingsTable';
import { useAlertmanager } from './state/AlertmanagerContext';
import { withPageErrorBoundary } from './withPageErrorBoundary';
import { AlertmanagerGroup, Receiver, Route, ROUTES_META_SYMBOL } from '../../../plugins/datasource/alertmanager/types';
import { stringifyErrorLike } from './utils/misc';
import {
  useDeleteRoutingTree,
  useListNotificationPolicyRoutes,
  useRootRouteSearch,
} from './components/notification-policies/useNotificationPolicyRoute';
import { useURLSearchParams } from './hooks/useURLSearchParams';
import { usePagination } from './hooks/usePagination';
import { useDeleteRoutingTreeModal } from './components/notification-policies/components/Modals';
import { ALL_ROUTING_TREES, useExportRoutingTree } from './components/notification-policies/useExportRoutingTree';
import { K8sAnnotations, ROOT_ROUTE_NAME } from './utils/k8s/constants';
import ConditionalWrap from './components/ConditionalWrap';
import { ProvisioningBadge } from './components/Provisioning';
import { getAnnotation } from './utils/k8s/utils';
import { Spacer } from './components/Spacer';
import MoreButton from './components/MoreButton';
import { useContactPointsWithStatus } from './components/contact-points/useContactPoints';
import { useAlertGroupsModal } from './components/notification-policies/Modals';
import { normalizeMatchers } from './utils/matchers';
import { RoutingTreeFilter } from './components/notification-policies/components/RoutingTreeFilter';

enum ActiveTab {
  NotificationPolicies = 'notification_policies',
  TimeIntervals = 'time_intervals',
}

const NotificationPoliciesTabs = () => {
  const styles = useStyles2(getStyles);

  // Alertmanager logic and data hooks
  const { selectedAlertmanager = '' } = useAlertmanager();
  const [policiesSupported, canSeePoliciesTab] = useAlertmanagerAbility(AlertmanagerAction.ViewNotificationPolicyTree);
  const [timingsSupported, canSeeTimingsTab] = useAlertmanagerAbility(AlertmanagerAction.ViewTimeInterval);
  const availableTabs = [
    canSeePoliciesTab && ActiveTab.NotificationPolicies,
    canSeeTimingsTab && ActiveTab.TimeIntervals,
  ].filter((tab) => !!tab);
  const { data: muteTimings = [] } = useMuteTimings({
    alertmanager: selectedAlertmanager,
    skip: !canSeeTimingsTab,
  });

  // Tab state management
  const [queryParams, setQueryParams] = useQueryParams();
  const { tab } = getActiveTabFromUrl(queryParams, availableTabs[0]);
  const [activeTab, setActiveTab] = useState<ActiveTab>(tab);

  const muteTimingsTabActive = activeTab === ActiveTab.TimeIntervals;
  const policyTreeTabActive = activeTab === ActiveTab.NotificationPolicies;

  const numberOfMuteTimings = muteTimings.length;

  return (
    <>
      <GrafanaAlertmanagerWarning currentAlertmanager={selectedAlertmanager} />
      <TabsBar>
        {policiesSupported && canSeePoliciesTab && (
          <Tab
            label={t('alerting.notification-policies-tabs.label-notification-policies', 'Notification Policies')}
            active={policyTreeTabActive}
            onChangeTab={() => {
              setActiveTab(ActiveTab.NotificationPolicies);
              setQueryParams({ tab: ActiveTab.NotificationPolicies });
            }}
          />
        )}
        {timingsSupported && canSeeTimingsTab && (
          <Tab
            label={t('alerting.notification-policies-tabs.label-time-intervals', 'Time intervals')}
            active={muteTimingsTabActive}
            counter={numberOfMuteTimings}
            onChangeTab={() => {
              setActiveTab(ActiveTab.TimeIntervals);
              setQueryParams({ tab: ActiveTab.TimeIntervals });
            }}
          />
        )}
      </TabsBar>
      <TabContent className={styles.tabContent}>
        {policyTreeTabActive && <PolicyTreeTab />}
        {muteTimingsTabActive && <TimeIntervalsTable />}
      </TabContent>
    </>
  );
};


const PolicyTreeTab = () => {
  const { isGrafanaAlertmanager } = useAlertmanager();

  if (!isGrafanaAlertmanager) {
    return <NotificationPoliciesTree />;
  }

  return <Stack direction="column">
           <PolicyTreeTabContents />
         </Stack>
}

const DEFAULT_PAGE_SIZE = 10;

const PolicyTreeTabContents = () => {
  const { selectedAlertmanager } = useAlertmanager();
  const [queryParams] = useURLSearchParams();

  const [[createPoliciesSupported, createPoliciesAllowed], [exportPoliciesSupported, exportPoliciesAllowed]] =
    useAlertmanagerAbilities([
      AlertmanagerAction.CreateNotificationPolicy,
      AlertmanagerAction.ExportNotificationPolicies,
    ]);

  const {
    currentData: allPolicies,
    isLoading,
    error: fetchPoliciesError,
  } = useListNotificationPolicyRoutes({ alertmanager: selectedAlertmanager ?? '' });

  const [ExportDrawer, showExportDrawer] = useExportRoutingTree();
  const search = queryParams.get('search');

  const [contactPointsSupported, canSeeContactPoints] = useAlertmanagerAbility(AlertmanagerAction.ViewContactPoint);
  const shouldFetchContactPoints = contactPointsSupported && canSeeContactPoints;
  const { contactPoints: receivers } = useContactPointsWithStatus({
    alertmanager: selectedAlertmanager ?? '',
    fetchPolicies: false,
    fetchStatuses: true,
    skip: !shouldFetchContactPoints,
  });

  if (isLoading) {
    return <LoadingPlaceholder text={'Loading...'} />;
  }

  return (
    <>
      {/* TODO we can add some additional info here with a ToggleTip */}
      <Stack direction="row" alignItems="end" justifyContent="space-between">
        <RoutingTreeFilter />

        <Stack direction="row" gap={1}>
          {createPoliciesSupported && (
            <LinkButton
              icon="plus"
              aria-label={'add policy'}
              variant="primary"
              href="/alerting/routes/new"
              disabled={!createPoliciesAllowed}
            >
              Create policy
            </LinkButton>
          )}
          {exportPoliciesSupported && (
            <Button
              icon="download-alt"
              variant="secondary"
              aria-label={'export all'}
              disabled={!exportPoliciesAllowed}
              onClick={() => showExportDrawer(ALL_ROUTING_TREES)}
            >
              Export all
            </Button>
          )}
        </Stack>
      </Stack>
      {fetchPoliciesError ? (
        <Alert title={'Failed to fetch policies'}>{stringifyErrorLike(fetchPoliciesError)}</Alert>
      ) : (
        <RoutingTreeList
          policies={allPolicies ?? []}
          search={search}
          pageSize={DEFAULT_PAGE_SIZE}
          receivers={receivers}
        />
      )}
      {ExportDrawer}
    </>
  );
};

interface RoutingTreeListProps {
  policies: Route[];
  search?: string | null;
  pageSize?: number;
  receivers?: Receiver[];
}

const RoutingTreeList = ({ policies, search, pageSize = DEFAULT_PAGE_SIZE, receivers }: RoutingTreeListProps) => {
  const searchResults = useRootRouteSearch(policies, search);
  const { page, pageItems, numberOfPages, onPageChange } = usePagination(searchResults, 1, pageSize);

  if (pageItems.length === 0) {
    return <EmptyState variant="not-found" message={'No policies found'} />;
  }

  return (
    <>
      {pageItems.map((policy, index) => {
        const key = `${policy.name}-${index}`;
        return <RoutingTree key={key} route={policy} receivers={receivers} />;
      })}
      <Pagination currentPage={page} numberOfPages={numberOfPages} onNavigate={onPageChange} hideWhenSinglePage />
    </>
  );
};

interface RoutingTreeProps {
  route: Route;
  receivers?: Receiver[];
}

export const RoutingTree = ({ route, receivers }: RoutingTreeProps) => {
  const styles = useStyles2(getStyles);
  const { selectedAlertmanager } = useAlertmanager();

  const [deleteTrigger] = useDeleteRoutingTree();
  const [DeleteModal, showDeleteModal] = useDeleteRoutingTreeModal(deleteTrigger.execute);
  const [alertInstancesModal, showAlertGroupsModal] = useAlertGroupsModal(selectedAlertmanager ?? '');

  const matchingInstancesPreview = { enabled: false }; // Placeholder for matching instances preview logic
  const numberOfAlertInstances = undefined; // Placeholder for number of alert instances logic
  const matchingAlertGroups: AlertmanagerGroup[] | undefined = []; // Placeholder for matching alert groups logic
  const matchers = normalizeMatchers(route);

  return (
    <div className={styles.routingTreeWrapper} data-testid="contact-point">
      <Stack direction="column" gap={0}>
        <RoutingTreeHeader
          route={route}
          onDelete={(routeToDelete) =>
            showDeleteModal({
              name: routeToDelete[ROUTES_META_SYMBOL]?.name ?? '',
              resourceVersion: routeToDelete[ROUTES_META_SYMBOL]?.resourceVersion,
            })
          }
        />

        <div className={styles.routingTreeMetadataWrapper}>
          <Stack direction="column" gap={0.5}>
            <MetadataRow
              matchingInstancesPreview={matchingInstancesPreview}
              numberOfAlertInstances={numberOfAlertInstances}
              contactPoint={route.receiver ?? undefined}
              groupBy={route.group_by ?? []}
              muteTimings={route.mute_time_intervals ?? []}
              activeTimings={route.active_time_intervals ?? []}
              timingOptions={{
                group_wait: route.group_wait,
                group_interval: route.group_interval,
                repeat_interval: route.repeat_interval,
              }}
              alertManagerSourceName={selectedAlertmanager ?? ''}
              receivers={receivers ?? []}
              matchingAlertGroups={matchingAlertGroups}
              matchers={matchers}
              isDefaultPolicy={true}
              onShowAlertInstances={showAlertGroupsModal}
            />
          </Stack>
        </div>
      </Stack>
      {DeleteModal}
      {alertInstancesModal}
    </div>
  );
};

interface RoutingTreeHeaderProps {
  route: Route;
  onDelete: (route: Route) => void;
}

export const RoutingTreeHeader = ({ route, onDelete }: RoutingTreeHeaderProps) => {
  const provisioned = route[ROUTES_META_SYMBOL]?.provisioned ?? false;
  const styles = useStyles2(getStyles);

  const [
    [updatePoliciesSupported, updatePoliciesAllowed],
    [deletePoliciesSupported, deletePoliciesAllowed],
    [exportPoliciesSupported, exportPoliciesAllowed],
  ] = useAlertmanagerAbilities([
    AlertmanagerAction.UpdateNotificationPolicyTree,
    AlertmanagerAction.DeleteNotificationPolicy,
    AlertmanagerAction.ExportNotificationPolicies,
  ]);

  const canEdit = updatePoliciesSupported && updatePoliciesAllowed && !provisioned;

  const [ExportDrawer, showExportDrawer] = useExportRoutingTree();

  const menuActions: JSX.Element[] = [];
  if (exportPoliciesSupported) {
    menuActions.push(
      <Fragment key="export-contact-point">
        <Menu.Item
          icon="download-alt"
          label={t('alerting.use-create-dropdown-menu-actions.label-export', 'Export')}
          ariaLabel="export"
          disabled={!exportPoliciesAllowed}
          data-testid="export"
          onClick={() => showExportDrawer(route.name ?? '')}
        />
        <Menu.Divider />
      </Fragment>
    );
  }

  if (deletePoliciesSupported) {
    const canBeDeleted = deletePoliciesAllowed && !provisioned;
    const isDefaultPolicy = route.name === ROOT_ROUTE_NAME;

    const cannotDeleteNoPermissions = `You do not have the required permission to ${isDefaultPolicy ? 'reset' : 'delete'} this routing tree`;
    const cannotDeleteProvisioned = `Routing tree is provisioned and cannot be ${isDefaultPolicy ? 'reset' : 'deleted'} via the UI`;

    const reasonsDeleteIsDisabled = [
      !deletePoliciesAllowed ? cannotDeleteNoPermissions : '',
      provisioned ? cannotDeleteProvisioned : '',
    ].filter(Boolean);

    const deleteTooltipContent = (
      <>
      {`Routing tree cannot be ${isDefaultPolicy ? 'reset' : 'deleted'} for the following reasons:`}
        <br />
        {reasonsDeleteIsDisabled.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </>
    );

    menuActions.push(
      <ConditionalWrap
        key="delete-routing-tree"
        shouldWrap={!canBeDeleted}
        wrap={(children) => (
          <Tooltip content={deleteTooltipContent} placement="top">
            <span>{children}</span>
          </Tooltip>
        )}
      >
        <Menu.Item
          label={route.name === ROOT_ROUTE_NAME ? "Reset" : t('alerting.use-create-dropdown-menu-actions.label-delete', 'Delete')}
          ariaLabel="delete"
          icon="trash-alt"
          destructive
          disabled={!canBeDeleted}
          onClick={() => onDelete(route)}
        />
      </ConditionalWrap>
    );
  }

  const routeName = route.name === ROOT_ROUTE_NAME || !route.name ? 'Default Policy' : route.name;
  const numberOfPolicies = countPolicies(route);

  return (
    <div className={styles.headerWrapper}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Stack alignItems="center" gap={1} minWidth={0}>
          <Text element="h2" variant="body" weight="medium" truncate>
            {routeName}
          </Text>
        </Stack>
        {numberOfPolicies > 0 && <>{`Contains ${numberOfPolicies} polic${numberOfPolicies > 1 ? 'ies' : 'y'}`}</>}
        {provisioned && (
          <ProvisioningBadge
            tooltip
            provenance={getAnnotation(route[ROUTES_META_SYMBOL] ?? {}, K8sAnnotations.Provenance)}
          />
        )}
        <Spacer />
        <LinkButton
          tooltipPlacement="top"
          tooltip={provisioned ? 'Provisioned routing trees cannot be edited in the UI' : undefined}
          variant="secondary"
          size="sm"
          icon={canEdit ? 'pen' : 'eye'}
          type="button"
          data-testid={`${canEdit ? 'edit' : 'view'}-action`}
          href={`/alerting/notifications/routes/${encodeURIComponent(route.name ?? '')}/edit`}
        >
          {canEdit ? 'Edit' : 'View'}
        </LinkButton>
        {menuActions.length > 0 && (
          <Dropdown overlay={<Menu>{menuActions}</Menu>}>
            <MoreButton aria-label={`More actions for routing tree "${route.name ?? ''}"`} />
          </Dropdown>
        )}
      </Stack>
      {ExportDrawer}
    </div>
  );
};

function countPolicies(route: Route): number {
  let count = 0;
  if (route.routes) {
    count += route.routes.length;
    route.routes.forEach((subRoute) => {
      count += countPolicies(subRoute);
    });
  }
  return count;
}

const getStyles = (theme: GrafanaTheme2) => ({
  tabContent: css({
    marginTop: theme.spacing(2),
  }),
  routingTreeWrapper: css({
    borderRadius: theme.shape.radius.default,
    border: `solid 1px ${theme.colors.border.weak}`,
    borderBottom: 'none',
  }),
  headerWrapper: css({
    background: `${theme.colors.background.secondary}`,
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,

    borderBottom: `solid 1px ${theme.colors.border.weak}`,
    borderTopLeftRadius: `${theme.shape.radius.default}`,
    borderTopRightRadius: `${theme.shape.radius.default}`,
  }),
  routingTreeMetadataWrapper: css({
    position: 'relative',

    background: `${theme.colors.background.primary}`,
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,

    borderBottom: `solid 1px ${theme.colors.border.weak}`,
  }),
});

interface QueryParamValues {
  tab: ActiveTab;
}

function getActiveTabFromUrl(queryParams: UrlQueryMap, defaultTab: ActiveTab): QueryParamValues {
  let tab = defaultTab;

  if (queryParams.tab === ActiveTab.NotificationPolicies) {
    tab = ActiveTab.NotificationPolicies;
  }

  if (queryParams.tab === ActiveTab.TimeIntervals) {
    tab = ActiveTab.TimeIntervals;
  }

  return {
    tab,
  };
}

function NotificationPoliciesPage() {
  return (
    <AlertmanagerPageWrapper navId="am-routes" accessType="notification">
      <NotificationPoliciesTabs />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(NotificationPoliciesPage);
