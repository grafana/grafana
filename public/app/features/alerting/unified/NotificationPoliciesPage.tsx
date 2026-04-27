import { css } from '@emotion/css';
import { isEqual } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSet } from 'react-use';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import type { UrlQueryMap } from '@grafana/data/utils';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, Button, LoadingPlaceholder, Stack, Tab, TabContent, TabsBar } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { useMuteTimings } from 'app/features/alerting/unified/components/mute-timings/useMuteTimings';
import {
  NotificationPoliciesFilter,
  useNotificationPoliciesFilters,
} from 'app/features/alerting/unified/components/notification-policies/Filters';
import { PoliciesTree } from 'app/features/alerting/unified/components/notification-policies/PoliciesTree';
import { CreateModal } from 'app/features/alerting/unified/components/notification-policies/components/Modals';
import {
  useCreatePolicyAction,
  useListNotificationPolicyRoutes,
} from 'app/features/alerting/unified/components/notification-policies/useNotificationPolicyRoute';
import { AlertmanagerAction, useAlertmanagerAbility } from 'app/features/alerting/unified/hooks/useAbilities';
import { useRouteGroupsMatcher } from 'app/features/alerting/unified/useRouteGroupsMatcher';
import { type ObjectMatcher } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from './api/alertmanagerApi';
import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import { GrafanaAlertmanagerWarning } from './components/GrafanaAlertmanagerWarning';
import { InhibitionRulesAlert } from './components/InhibitionRulesAlert';
import { Spacer } from './components/Spacer';
import { TimeIntervalsTable } from './components/mute-timings/MuteTimingsTable';
import {
  trackNotificationPoliciesFilterContactPoint,
  trackNotificationPoliciesFilterMatchers,
  trackNotificationPoliciesFilterPolicyTree,
  trackNotificationPoliciesToggledAll,
} from './components/notification-policies/notificationPolicyAnalytics';
import { useNotificationPoliciesNav } from './navigation/useNotificationConfigNav';
import { useAlertmanager } from './state/AlertmanagerContext';
import { ROOT_ROUTE_NAME } from './utils/k8s/constants';
import { stringifyErrorLike } from './utils/misc';
import { withPageErrorBoundary } from './withPageErrorBoundary';

enum ActiveTab {
  NotificationPolicies = 'notification_policies',
  TimeIntervals = 'time_intervals',
}

const NotificationPoliciesTabs = () => {
  const styles = useStyles2(getStyles);

  // When V2 navigation is enabled, Time Intervals has its own dedicated tab in the navigation,
  // so we don't show local tabs here - just show the notification policies content directly
  const useV2Nav = config.featureToggles.alertingNavigationV2;

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

  // V2 Navigation: No local tabs, just show notification policies content
  if (useV2Nav) {
    return (
      <>
        <GrafanaAlertmanagerWarning currentAlertmanager={selectedAlertmanager} />
        <InhibitionRulesAlert alertmanagerSourceName={selectedAlertmanager} />
        <PolicyTreeTab />
      </>
    );
  }

  // Legacy Navigation: Show local tabs for Notification Policies and Time Intervals
  return (
    <>
      <GrafanaAlertmanagerWarning currentAlertmanager={selectedAlertmanager} />
      <InhibitionRulesAlert alertmanagerSourceName={selectedAlertmanager} />
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

/**
 * Unified policy tree view that handles both single and multiple policy trees.
 * Owns the single Web Worker instance and alert groups query shared by all PoliciesTree children.
 *
 * When the `alertingMultiplePolicies` feature toggle is enabled (Grafana AM only),
 * lists all policy trees with create/filter/expand controls.
 * Otherwise, renders a single default policy tree.
 */
function PolicyTreeTab() {
  const { selectedAlertmanager = '', isGrafanaAlertmanager } = useAlertmanager();
  const [, canSeeAlertGroups] = useAlertmanagerAbility(AlertmanagerAction.ViewAlertGroups);

  // Single worker + alert groups query shared by all PoliciesTree instances
  const { getRouteGroupsMap } = useRouteGroupsMatcher();
  const { currentData: alertGroups, refetch: refetchAlertGroups } = alertmanagerApi.useGetAlertmanagerAlertGroupsQuery(
    { amSourceName: selectedAlertmanager },
    { skip: !canSeeAlertGroups || !selectedAlertmanager }
  );

  const useMultiplePolicies = isGrafanaAlertmanager && config.featureToggles.alertingMultiplePolicies;

  const {
    currentData: allPolicies,
    isLoading,
    error: fetchPoliciesError,
  } = useListNotificationPolicyRoutes({ skip: !useMultiplePolicies });

  const {
    isCreateModalOpen,
    openCreateModal,
    closeCreateModal,
    createPoliciesSupported,
    createPoliciesAllowed,
    createTrigger,
    existingPolicyNames,
  } = useCreatePolicyAction(allPolicies);

  const { selectedPolicyTreeNames } = useNotificationPoliciesFilters();

  const [contactPointFilter, setContactPointFilter] = useState<string | undefined>();
  const [labelMatchersFilter, setLabelMatchersFilter] = useState<ObjectMatcher[]>([]);

  const prevLabelMatchersRef = useRef<ObjectMatcher[]>([]);
  const prevContactPointRef = useRef<string | undefined>(undefined);

  /**
   * Expand / collapse state
   * `defaultExpanded` is the baseline; `expandedOverrides` holds route IDs (hash-based) that are
   * toggled opposite to the baseline. Individual toggle receives the route's hash-based id from Policy.
   * "Expand all" / "Collapse all" flip the baseline and clear overrides.
   */
  const [expandedOverrides, { toggle: handleTogglePolicyExpanded, clear }] = useSet<string>(new Set());
  const [manualDefaultExpanded, setManualDefaultExpanded] = useState<boolean | undefined>(undefined);

  // Resets the expand/collapse state back to auto-expand mode
  const resetExpandState = useCallback(() => {
    setManualDefaultExpanded(undefined);
    clear();
  }, [clear]);

  const handleChangeContactPoint = useCallback(
    (value: string | undefined) => {
      if (prevContactPointRef.current === value) {
        return;
      }
      prevContactPointRef.current = value;
      if (value) {
        trackNotificationPoliciesFilterContactPoint();
      }
      setContactPointFilter(value);
      resetExpandState();
    },
    [resetExpandState]
  );

  const handleChangeLabelMatchers = useCallback(
    (value: ObjectMatcher[]) => {
      if (isEqual(prevLabelMatchersRef.current, value)) {
        return;
      }
      prevLabelMatchersRef.current = value;
      if (value.length > 0) {
        trackNotificationPoliciesFilterMatchers();
      }
      setLabelMatchersFilter(value);
      resetExpandState();
    },
    [resetExpandState]
  );

  // Reset expand state when the policy-tree selector filter changes
  useEffect(() => {
    if (selectedPolicyTreeNames.length > 0) {
      trackNotificationPoliciesFilterPolicyTree({ selectedCount: selectedPolicyTreeNames.length });
    }
    resetExpandState();
  }, [selectedPolicyTreeNames, resetExpandState]);

  const sortedPolicies = useMemo(() => sortPoliciesDefaultFirst(allPolicies), [allPolicies]);

  // Filter to only selected trees (or all if no selection)
  const visiblePolicies = useMemo(() => {
    if (selectedPolicyTreeNames.length === 0) {
      return sortedPolicies;
    }
    return sortedPolicies.filter((policy) => {
      const name = policy.name ?? ROOT_ROUTE_NAME;
      return selectedPolicyTreeNames.includes(name);
    });
  }, [sortedPolicies, selectedPolicyTreeNames]);

  const hasActiveFilters = Boolean(contactPointFilter) || labelMatchersFilter.length > 0;
  // Auto-expand when there is only one visible tree or filters are active; collapse when there are multiple trees
  const defaultExpanded = manualDefaultExpanded ?? (visiblePolicies.length === 1 || hasActiveFilters);
  // All expanded when: default=expanded with no individual collapses,
  // OR default=collapsed but every visible policy root has been individually toggled open.
  const isAllExpanded = defaultExpanded
    ? expandedOverrides.size === 0
    : expandedOverrides.size === visiblePolicies.length;

  const toggleAllExpanded = useCallback(() => {
    trackNotificationPoliciesToggledAll({
      action: isAllExpanded ? 'collapse' : 'expand',
      visiblePoliciesCount: visiblePolicies.length,
    });
    setManualDefaultExpanded(!isAllExpanded);
    clear();
  }, [isAllExpanded, clear, visiblePolicies]);

  // Single-tree mode: show filters but no collapse/expand or create button
  if (!useMultiplePolicies) {
    return (
      <Stack direction="column" gap={2}>
        <NotificationPoliciesFilter
          onChangeMatchers={handleChangeLabelMatchers}
          onChangeReceiver={handleChangeContactPoint}
        />
        <PoliciesTree
          contactPointFilter={contactPointFilter}
          labelMatchersFilter={labelMatchersFilter}
          alertGroups={alertGroups}
          refetchAlertGroups={refetchAlertGroups}
          getRouteGroupsMap={getRouteGroupsMap}
        />
      </Stack>
    );
  }

  if (isLoading) {
    return <LoadingPlaceholder text={t('alerting.policies-list.text-loading', 'Loading....')} />;
  }

  if (fetchPoliciesError) {
    return (
      <Alert title={t('alerting.policies-list.fetch.error', 'Failed to fetch policies')}>
        {stringifyErrorLike(fetchPoliciesError)}
      </Alert>
    );
  }

  return (
    <>
      <Stack direction="column" gap={2}>
        {/* Filter bar row */}
        <Stack direction="row" alignItems="flex-end" gap={1} wrap="wrap">
          <NotificationPoliciesFilter
            onChangeMatchers={handleChangeLabelMatchers}
            onChangeReceiver={handleChangeContactPoint}
          />
          <Button
            icon={isAllExpanded ? 'table-collapse-all' : 'table-expand-all'}
            onClick={toggleAllExpanded}
            variant="secondary"
            aria-label={
              isAllExpanded
                ? t('alerting.multiple-policies-view.collapse-all', 'Collapse all')
                : t('alerting.multiple-policies-view.expand-all', 'Expand all')
            }
          >
            {isAllExpanded ? (
              <Trans i18nKey="alerting.multiple-policies-view.collapse-all">Collapse all</Trans>
            ) : (
              <Trans i18nKey="alerting.multiple-policies-view.expand-all">Expand all</Trans>
            )}
          </Button>
          <Spacer />
          {createPoliciesSupported && (
            <Button
              data-testid="create-policy-button"
              icon="plus"
              aria-label={t('alerting.policies-list.create.aria-label', 'add policy')}
              variant="primary"
              disabled={!createPoliciesAllowed}
              onClick={openCreateModal}
            >
              <Trans i18nKey="alerting.policies-list.create.text">New notification policy</Trans>
            </Button>
          )}
        </Stack>

        <Stack direction="column" gap={0} alignItems="stretch">
          {visiblePolicies.map((policy) => (
            <PoliciesTree
              key={policy.name ?? ROOT_ROUTE_NAME}
              routeName={policy.name}
              contactPointFilter={contactPointFilter}
              labelMatchersFilter={labelMatchersFilter}
              defaultExpanded={defaultExpanded}
              expandedOverrides={expandedOverrides}
              onTogglePolicyExpanded={handleTogglePolicyExpanded}
              alertGroups={alertGroups}
              refetchAlertGroups={refetchAlertGroups}
              getRouteGroupsMap={getRouteGroupsMap}
            />
          ))}
        </Stack>
      </Stack>
      <CreateModal
        existingPolicyNames={existingPolicyNames}
        isOpen={isCreateModalOpen}
        onConfirm={(route) => createTrigger.execute(route)}
        onDismiss={closeCreateModal}
      />
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  tabContent: css({
    marginTop: theme.spacing(2),
  }),
});

interface QueryParamValues {
  tab: ActiveTab;
}

/**
 * Sort policies so that the default policy (ROOT_ROUTE_NAME or unnamed) comes first
 */
function sortPoliciesDefaultFirst<T extends { name?: string }>(policies: T[] | undefined): T[] {
  if (!policies) {
    return [];
  }
  return [...policies].sort((a, b) => {
    const aIsDefault = a.name === ROOT_ROUTE_NAME || !a.name;
    const bIsDefault = b.name === ROOT_ROUTE_NAME || !b.name;
    if (aIsDefault && !bIsDefault) {
      return -1;
    }
    if (!aIsDefault && bIsDefault) {
      return 1;
    }
    return 0;
  });
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
  const { navId, pageNav } = useNotificationPoliciesNav();

  return (
    <AlertmanagerPageWrapper navId={navId} pageNav={pageNav} accessType="notification">
      <NotificationPoliciesTabs />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(NotificationPoliciesPage);
