import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';
import { useAsyncFn } from 'react-use';

import { GrafanaTheme2, UrlQueryMap } from '@grafana/data';
import {
  Alert,
  Button,
  LoadingPlaceholder,
  Stack,
  Tab,
  TabContent,
  TabsBar,
  useStyles2,
  withErrorBoundary,
} from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { Trans } from 'app/core/internationalization';
import { useContactPointsWithStatus } from 'app/features/alerting/unified/components/contact-points/useContactPoints';
import { useMuteTimings } from 'app/features/alerting/unified/components/mute-timings/useMuteTimings';
import { AlertmanagerAction, useAlertmanagerAbility } from 'app/features/alerting/unified/hooks/useAbilities';
import { ObjectMatcher, Route, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from './api/alertmanagerApi';
import { useGetContactPointsState } from './api/receiversApi';
import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import { GrafanaAlertmanagerDeliveryWarning } from './components/GrafanaAlertmanagerDeliveryWarning';
import { MuteTimingsTable } from './components/mute-timings/MuteTimingsTable';
import {
  NotificationPoliciesFilter,
  findRoutesByMatchers,
  findRoutesMatchingPredicate,
} from './components/notification-policies/Filters';
import {
  useAddPolicyModal,
  useAlertGroupsModal,
  useDeletePolicyModal,
  useEditPolicyModal,
} from './components/notification-policies/Modals';
import { Policy } from './components/notification-policies/Policy';
import {
  useNotificationPolicyRoute,
  useUpdateNotificationPolicyRoute,
} from './components/notification-policies/useNotificationPolicyRoute';
import { isLoading as isPending, useAsync } from './hooks/useAsync';
import { useAlertmanager } from './state/AlertmanagerContext';
import { FormAmRoute } from './types/amroutes';
import { useRouteGroupsMatcher } from './useRouteGroupsMatcher';
import { addUniqueIdentifierToRoute } from './utils/amroutes';
import { ERROR_NEWER_CONFIGURATION } from './utils/k8s/errors';
import { isErrorMatchingCode, stringifyErrorLike } from './utils/misc';
import { computeInheritedTree } from './utils/notification-policies';
import {
  InsertPosition,
  addRouteToReferenceRoute,
  cleanRouteIDs,
  mergePartialAmRouteWithRouteTree,
  omitRouteFromRouteTree,
} from './utils/routeTree';

enum ActiveTab {
  NotificationPolicies = 'notification_policies',
  MuteTimings = 'mute_timings',
}

const AmRoutes = () => {
  const styles = useStyles2(getStyles);
  const appNotification = useAppNotification();
  const [policiesSupported, canSeePoliciesTab] = useAlertmanagerAbility(AlertmanagerAction.ViewNotificationPolicyTree);
  const [timingsSupported, canSeeTimingsTab] = useAlertmanagerAbility(AlertmanagerAction.ViewMuteTiming);
  const [contactPointsSupported, canSeeContactPointsStatus] = useAlertmanagerAbility(
    AlertmanagerAction.ViewContactPoint
  );
  const availableTabs = [
    canSeePoliciesTab && ActiveTab.NotificationPolicies,
    canSeeTimingsTab && ActiveTab.MuteTimings,
  ].filter((tab) => !!tab);
  const [_, canSeeAlertGroups] = useAlertmanagerAbility(AlertmanagerAction.ViewAlertGroups);
  const { useGetAlertmanagerAlertGroupsQuery } = alertmanagerApi;

  const [queryParams, setQueryParams] = useQueryParams();
  const { tab } = getActiveTabFromUrl(queryParams, availableTabs[0]);

  const [activeTab, setActiveTab] = useState<ActiveTab>(tab);

  const [contactPointFilter, setContactPointFilter] = useState<string | undefined>();
  const [labelMatchersFilter, setLabelMatchersFilter] = useState<ObjectMatcher[]>([]);

  const { selectedAlertmanager, hasConfigurationAPI, isGrafanaAlertmanager } = useAlertmanager();
  const { getRouteGroupsMap } = useRouteGroupsMatcher();
  const { data: muteTimings = [] } = useMuteTimings({
    alertmanager: selectedAlertmanager ?? '',
    skip: !canSeeTimingsTab,
  });

  const shouldFetchContactPoints =
    policiesSupported && canSeePoliciesTab && contactPointsSupported && canSeeContactPointsStatus;

  const contactPointsState = useGetContactPointsState(
    // Workaround to not try and call this API when we don't have access to the policies tab
    shouldFetchContactPoints ? (selectedAlertmanager ?? '') : ''
  );

  const {
    currentData,
    isLoading,
    error: resultError,
    refetch: refetchNotificationPolicyRoute,
  } = useNotificationPolicyRoute({ alertmanager: selectedAlertmanager ?? '' }, { skip: !canSeePoliciesTab });

  // We make the assumption that the first policy is the default one
  // At the time of writing, this will be always the case for the AM config response, and the K8S API
  // TODO in the future: Generalise the component to support any number of "root" policies
  const [defaultPolicy] = currentData ?? [];

  const updateNotificationPolicyRoute = useUpdateNotificationPolicyRoute(selectedAlertmanager ?? '');

  const { currentData: alertGroups, refetch: refetchAlertGroups } = useGetAlertmanagerAlertGroupsQuery(
    { amSourceName: selectedAlertmanager ?? '' },
    { skip: !canSeePoliciesTab || !canSeeAlertGroups || !selectedAlertmanager }
  );

  const { contactPoints: receivers } = useContactPointsWithStatus({
    alertmanager: selectedAlertmanager ?? '',
    fetchPolicies: false,
    fetchStatuses: canSeeContactPointsStatus,
    skip: !canSeePoliciesTab,
  });

  const rootRoute = useMemo(() => {
    if (defaultPolicy) {
      return addUniqueIdentifierToRoute(defaultPolicy);
    }
    return;
  }, [defaultPolicy]);

  // useAsync could also work but it's hard to wait until it's done in the tests
  // Combining with useEffect gives more predictable results because the condition is in useEffect
  const [{ value: routeAlertGroupsMap, error: instancesPreviewError }, triggerGetRouteGroupsMap] = useAsyncFn(
    getRouteGroupsMap,
    [getRouteGroupsMap]
  );

  useEffect(() => {
    if (rootRoute && alertGroups) {
      triggerGetRouteGroupsMap(rootRoute, alertGroups, { unquoteMatchers: !isGrafanaAlertmanager });
    }
  }, [rootRoute, alertGroups, triggerGetRouteGroupsMap, isGrafanaAlertmanager]);

  // these are computed from the contactPoint and labels matchers filter
  const routesMatchingFilters = useMemo(() => {
    if (!rootRoute) {
      const emptyResult: RoutesMatchingFilters = {
        filtersApplied: false,
        matchedRoutesWithPath: new Map(),
      };

      return emptyResult;
    }

    return findRoutesMatchingFilters(rootRoute, { contactPointFilter, labelMatchersFilter });
  }, [contactPointFilter, labelMatchersFilter, rootRoute]);

  const refetchPolicies = () => {
    refetchNotificationPolicyRoute();
    updateRouteTree.reset();
  };

  function handleSave(partialRoute: Partial<FormAmRoute>) {
    if (!rootRoute) {
      return;
    }

    const newRouteTree = mergePartialAmRouteWithRouteTree(selectedAlertmanager ?? '', partialRoute, rootRoute);
    updateRouteTree.execute(newRouteTree);
  }

  function handleDelete(route: RouteWithID) {
    if (!rootRoute) {
      return;
    }
    const newRouteTree = omitRouteFromRouteTree(route, rootRoute);
    updateRouteTree.execute(newRouteTree);
  }

  function handleAdd(partialRoute: Partial<FormAmRoute>, referenceRoute: RouteWithID, insertPosition: InsertPosition) {
    if (!rootRoute) {
      return;
    }

    const newRouteTree = addRouteToReferenceRoute(
      selectedAlertmanager ?? '',
      partialRoute,
      referenceRoute,
      rootRoute,
      insertPosition
    );
    updateRouteTree.execute(newRouteTree);
  }

  // this function will make the HTTP request and tracks the state of the request
  const [updateRouteTree, updateRouteTreeState] = useAsync(async (routeTree: Route | RouteWithID) => {
    if (!rootRoute) {
      return;
    }

    // make sure we omit all IDs from our routes
    const newRouteTree = cleanRouteIDs(routeTree);

    const newTree = await updateNotificationPolicyRoute({
      newRoute: newRouteTree,
      oldRoute: defaultPolicy,
    });

    appNotification.success('Updated notification policies');
    if (selectedAlertmanager) {
      refetchAlertGroups();
    }

    // close all modals
    closeEditModal();
    closeAddModal();
    closeDeleteModal();

    return newTree;
  });

  const updatingTree = isPending(updateRouteTreeState);
  const updateError = updateRouteTreeState.error;

  // edit, add, delete modals
  const [addModal, openAddModal, closeAddModal] = useAddPolicyModal(handleAdd, updatingTree);
  const [editModal, openEditModal, closeEditModal] = useEditPolicyModal(
    selectedAlertmanager ?? '',
    handleSave,
    updatingTree,
    updateError
  );
  const [deleteModal, openDeleteModal, closeDeleteModal] = useDeletePolicyModal(handleDelete, updatingTree);
  const [alertInstancesModal, showAlertGroupsModal] = useAlertGroupsModal(selectedAlertmanager ?? '');

  if (!selectedAlertmanager) {
    return null;
  }

  const numberOfMuteTimings = muteTimings.length;
  const hasPoliciesData = rootRoute && !resultError && !isLoading;
  const hasPoliciesError = !!resultError && !isLoading;

  const muteTimingsTabActive = activeTab === ActiveTab.MuteTimings;
  const policyTreeTabActive = activeTab === ActiveTab.NotificationPolicies;

  return (
    <>
      <GrafanaAlertmanagerDeliveryWarning currentAlertmanager={selectedAlertmanager} />
      <TabsBar>
        {policiesSupported && canSeePoliciesTab && (
          <Tab
            label={'Notification Policies'}
            active={policyTreeTabActive}
            onChangeTab={() => {
              setActiveTab(ActiveTab.NotificationPolicies);
              setQueryParams({ tab: ActiveTab.NotificationPolicies });
            }}
          />
        )}
        {timingsSupported && canSeeTimingsTab && (
          <Tab
            label={'Mute Timings'}
            active={muteTimingsTabActive}
            counter={numberOfMuteTimings}
            onChangeTab={() => {
              setActiveTab(ActiveTab.MuteTimings);
              setQueryParams({ tab: ActiveTab.MuteTimings });
            }}
          />
        )}
      </TabsBar>
      <TabContent className={styles.tabContent}>
        {isLoading && <LoadingPlaceholder text="Loading notification policies..." />}

        {policyTreeTabActive && (
          <>
            {hasPoliciesError && (
              <Alert severity="error" title="Error loading Alertmanager config">
                {stringifyErrorLike(resultError) || 'Unknown error.'}
              </Alert>
            )}
            {/* show when there is an update error */}
            {isErrorMatchingCode(updateError, ERROR_NEWER_CONFIGURATION) && (
              <Alert severity="info" title="Notification policies have changed">
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Trans i18nKey="alerting.policies.update-errors.conflict">
                    The notification policy tree has been updated by another user.
                  </Trans>
                  <Button onClick={refetchPolicies}>
                    <Trans i18nKey="alerting.policies.reload-policies">Reload policies</Trans>
                  </Button>
                </Stack>
              </Alert>
            )}
            {hasPoliciesData && (
              <Stack direction="column" gap={1}>
                {rootRoute && (
                  <NotificationPoliciesFilter
                    onChangeMatchers={setLabelMatchersFilter}
                    onChangeReceiver={setContactPointFilter}
                    matchingCount={routesMatchingFilters.matchedRoutesWithPath.size}
                  />
                )}
                {rootRoute && (
                  <Policy
                    receivers={receivers}
                    currentRoute={rootRoute}
                    contactPointsState={contactPointsState.receivers}
                    readOnly={!hasConfigurationAPI}
                    provisioned={rootRoute._metadata?.provisioned}
                    alertManagerSourceName={selectedAlertmanager}
                    onAddPolicy={openAddModal}
                    onEditPolicy={openEditModal}
                    onDeletePolicy={openDeleteModal}
                    onShowAlertInstances={showAlertGroupsModal}
                    routesMatchingFilters={routesMatchingFilters}
                    matchingInstancesPreview={{
                      groupsMap: routeAlertGroupsMap,
                      enabled: Boolean(canSeeAlertGroups && !instancesPreviewError),
                    }}
                    isAutoGenerated={false}
                    isDefaultPolicy
                  />
                )}
              </Stack>
            )}
            {addModal}
            {editModal}
            {deleteModal}
            {alertInstancesModal}
          </>
        )}
        {muteTimingsTabActive && (
          <MuteTimingsTable alertManagerSourceName={selectedAlertmanager} hideActions={!hasConfigurationAPI} />
        )}
      </TabContent>
    </>
  );
};

type RouteFilters = {
  contactPointFilter?: string;
  labelMatchersFilter?: ObjectMatcher[];
};

type FilterResult = Map<RouteWithID, RouteWithID[]>;

export interface RoutesMatchingFilters {
  filtersApplied: boolean;
  matchedRoutesWithPath: FilterResult;
}

export const findRoutesMatchingFilters = (rootRoute: RouteWithID, filters: RouteFilters): RoutesMatchingFilters => {
  const { contactPointFilter, labelMatchersFilter = [] } = filters;
  const hasFilter = contactPointFilter || labelMatchersFilter.length > 0;
  const havebothFilters = Boolean(contactPointFilter) && labelMatchersFilter.length > 0;

  // if filters are empty we short-circuit this function
  if (!hasFilter) {
    return { filtersApplied: false, matchedRoutesWithPath: new Map() };
  }

  // we'll collect all of the routes matching the filters
  // we track an array of matching routes, each item in the array is for 1 type of filter
  //
  // [contactPointMatches, labelMatcherMatches] -> [[{ a: [], b: [] }], [{ a: [], c: [] }]]
  // later we'll use intersection to find results in all sets of filter matchers
  const matchedRoutes: RouteWithID[][] = [];

  // compute fully inherited tree so all policies have their inherited receiver
  const fullRoute = computeInheritedTree(rootRoute);

  // find all routes for our contact point filter
  const matchingRoutesForContactPoint = contactPointFilter
    ? findRoutesMatchingPredicate(fullRoute, (route) => route.receiver === contactPointFilter)
    : new Map();

  const routesMatchingContactPoint = Array.from(matchingRoutesForContactPoint.keys());
  if (routesMatchingContactPoint) {
    matchedRoutes.push(routesMatchingContactPoint);
  }

  // find all routes matching our label matchers
  const matchingRoutesForLabelMatchers = labelMatchersFilter.length
    ? findRoutesMatchingPredicate(fullRoute, (route) => findRoutesByMatchers(route, labelMatchersFilter))
    : new Map();

  const routesMatchingLabelFilters = Array.from(matchingRoutesForLabelMatchers.keys());
  if (matchingRoutesForLabelMatchers.size > 0) {
    matchedRoutes.push(routesMatchingLabelFilters);
  }

  // now that we have our maps for all filters, we just need to find the intersection of all maps by route if we have both filters
  const routesForAllFilterResults = havebothFilters
    ? findMapIntersection(matchingRoutesForLabelMatchers, matchingRoutesForContactPoint)
    : new Map([...matchingRoutesForLabelMatchers, ...matchingRoutesForContactPoint]);

  return {
    filtersApplied: true,
    matchedRoutesWithPath: routesForAllFilterResults,
  };
};

// this function takes multiple maps and creates a new map with routes that exist in all maps
//
// map 1: { a: [], b: [] }
// map 2: { a: [], c: [] }
// return: { a: [] }
function findMapIntersection(...matchingRoutes: FilterResult[]): FilterResult {
  const result = new Map<RouteWithID, RouteWithID[]>();

  // Iterate through the keys of the first map'
  for (const key of matchingRoutes[0].keys()) {
    // Check if the key exists in all other maps
    if (matchingRoutes.every((map) => map.has(key))) {
      // If yes, add the key to the result map
      // @ts-ignore
      result.set(key, matchingRoutes[0].get(key));
    }
  }

  return result;
}

const getStyles = (theme: GrafanaTheme2) => ({
  tabContent: css({
    marginTop: theme.spacing(2),
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

  if (queryParams.tab === ActiveTab.MuteTimings) {
    tab = ActiveTab.MuteTimings;
  }

  return {
    tab,
  };
}

const NotificationPoliciesPage = () => (
  <AlertmanagerPageWrapper navId="am-routes" accessType="notification">
    <AmRoutes />
  </AlertmanagerPageWrapper>
);

export default withErrorBoundary(NotificationPoliciesPage, { style: 'page' });
