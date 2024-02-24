import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';
import { useAsyncFn } from 'react-use';

import { GrafanaTheme2, UrlQueryMap } from '@grafana/data';
import { Alert, LoadingPlaceholder, Stack, Tab, TabContent, TabsBar, useStyles2, withErrorBoundary } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { ObjectMatcher, Route, RouteWithID } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import { useCleanup } from '../../../core/hooks/useCleanup';

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
import { useAlertmanagerConfig } from './hooks/useAlertmanagerConfig';
import { useAlertmanager } from './state/AlertmanagerContext';
import { updateAlertManagerConfigAction } from './state/actions';
import { FormAmRoute } from './types/amroutes';
import { useRouteGroupsMatcher } from './useRouteGroupsMatcher';
import { addUniqueIdentifierToRoute } from './utils/amroutes';
import { computeInheritedTree } from './utils/notification-policies';
import { initialAsyncRequestState } from './utils/redux';
import { addRouteToParentRoute, mergePartialAmRouteWithRouteTree, omitRouteFromRouteTree } from './utils/routeTree';

enum ActiveTab {
  NotificationPolicies = 'notification_policies',
  MuteTimings = 'mute_timings',
}

const AmRoutes = () => {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);

  const { useGetAlertmanagerAlertGroupsQuery } = alertmanagerApi;

  const [queryParams, setQueryParams] = useQueryParams();
  const { tab } = getActiveTabFromUrl(queryParams);

  const [activeTab, setActiveTab] = useState<ActiveTab>(tab);
  const [updatingTree, setUpdatingTree] = useState<boolean>(false);
  const [contactPointFilter, setContactPointFilter] = useState<string | undefined>();
  const [labelMatchersFilter, setLabelMatchersFilter] = useState<ObjectMatcher[]>([]);

  const { selectedAlertmanager, hasConfigurationAPI, isGrafanaAlertmanager } = useAlertmanager();
  const { getRouteGroupsMap } = useRouteGroupsMatcher();

  const contactPointsState = useGetContactPointsState(selectedAlertmanager ?? '');

  const {
    currentData: result,
    isLoading: resultLoading,
    error: resultError,
  } = useAlertmanagerConfig(selectedAlertmanager, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const config = result?.alertmanager_config;

  const { currentData: alertGroups, refetch: refetchAlertGroups } = useGetAlertmanagerAlertGroupsQuery(
    { amSourceName: selectedAlertmanager ?? '' },
    { skip: !selectedAlertmanager }
  );

  const receivers = config?.receivers ?? [];

  const rootRoute = useMemo(() => {
    if (config?.route) {
      return addUniqueIdentifierToRoute(config.route);
    }
    return;
  }, [config?.route]);

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

  const isProvisioned = Boolean(config?.route?.provenance);

  function handleSave(partialRoute: Partial<FormAmRoute>) {
    if (!rootRoute) {
      return;
    }
    const newRouteTree = mergePartialAmRouteWithRouteTree(selectedAlertmanager ?? '', partialRoute, rootRoute);
    updateRouteTree(newRouteTree);
  }

  function handleDelete(route: RouteWithID) {
    if (!rootRoute) {
      return;
    }
    const newRouteTree = omitRouteFromRouteTree(route, rootRoute);
    updateRouteTree(newRouteTree);
  }

  function handleAdd(partialRoute: Partial<FormAmRoute>, parentRoute: RouteWithID) {
    if (!rootRoute) {
      return;
    }

    const newRouteTree = addRouteToParentRoute(selectedAlertmanager ?? '', partialRoute, parentRoute, rootRoute);
    updateRouteTree(newRouteTree);
  }

  function updateRouteTree(routeTree: Route) {
    if (!result) {
      return;
    }

    setUpdatingTree(true);

    dispatch(
      updateAlertManagerConfigAction({
        newConfig: {
          ...result,
          alertmanager_config: {
            ...result.alertmanager_config,
            route: routeTree,
          },
        },
        oldConfig: result,
        alertManagerSourceName: selectedAlertmanager!,
        successMessage: 'Updated notification policies',
      })
    )
      .unwrap()
      .then(() => {
        if (selectedAlertmanager) {
          refetchAlertGroups();
        }
        closeEditModal();
        closeAddModal();
        closeDeleteModal();
      })
      .finally(() => {
        setUpdatingTree(false);
      });
  }

  // edit, add, delete modals
  const [addModal, openAddModal, closeAddModal] = useAddPolicyModal(receivers, handleAdd, updatingTree);
  const [editModal, openEditModal, closeEditModal] = useEditPolicyModal(
    selectedAlertmanager ?? '',
    receivers,
    handleSave,
    updatingTree
  );
  const [deleteModal, openDeleteModal, closeDeleteModal] = useDeletePolicyModal(handleDelete, updatingTree);
  const [alertInstancesModal, showAlertGroupsModal] = useAlertGroupsModal();

  useCleanup((state) => (state.unifiedAlerting.saveAMConfig = initialAsyncRequestState));

  if (!selectedAlertmanager) {
    return null;
  }

  const numberOfMuteTimings = result?.alertmanager_config.mute_time_intervals?.length ?? 0;
  const haveData = result && !resultError && !resultLoading;
  const isFetching = !result && resultLoading;
  const haveError = resultError && !resultLoading;

  const muteTimingsTabActive = activeTab === ActiveTab.MuteTimings;
  const policyTreeTabActive = activeTab === ActiveTab.NotificationPolicies;

  return (
    <>
      <TabsBar>
        <Tab
          label={'Notification Policies'}
          active={policyTreeTabActive}
          onChangeTab={() => {
            setActiveTab(ActiveTab.NotificationPolicies);
            setQueryParams({ tab: ActiveTab.NotificationPolicies });
          }}
        />
        <Tab
          label={'Mute Timings'}
          active={muteTimingsTabActive}
          counter={numberOfMuteTimings}
          onChangeTab={() => {
            setActiveTab(ActiveTab.MuteTimings);
            setQueryParams({ tab: ActiveTab.MuteTimings });
          }}
        />
      </TabsBar>
      <TabContent className={styles.tabContent}>
        {isFetching && <LoadingPlaceholder text="Loading Alertmanager config..." />}
        {haveError && (
          <Alert severity="error" title="Error loading Alertmanager config">
            {resultError.message || 'Unknown error.'}
          </Alert>
        )}
        {haveData && (
          <>
            {policyTreeTabActive && (
              <>
                <GrafanaAlertmanagerDeliveryWarning currentAlertmanager={selectedAlertmanager} />
                <Stack direction="column" gap={1}>
                  {rootRoute && (
                    <NotificationPoliciesFilter
                      receivers={receivers}
                      onChangeMatchers={setLabelMatchersFilter}
                      onChangeReceiver={setContactPointFilter}
                      matchingCount={routesMatchingFilters.matchedRoutesWithPath.size}
                    />
                  )}
                  {rootRoute && (
                    <Policy
                      receivers={receivers}
                      routeTree={rootRoute}
                      currentRoute={rootRoute}
                      alertGroups={alertGroups ?? []}
                      contactPointsState={contactPointsState.receivers}
                      readOnly={!hasConfigurationAPI}
                      provisioned={isProvisioned}
                      alertManagerSourceName={selectedAlertmanager}
                      onAddPolicy={openAddModal}
                      onEditPolicy={openEditModal}
                      onDeletePolicy={openDeleteModal}
                      onShowAlertInstances={showAlertGroupsModal}
                      routesMatchingFilters={routesMatchingFilters}
                      matchingInstancesPreview={{ groupsMap: routeAlertGroupsMap, enabled: !instancesPreviewError }}
                      isAutoGenerated={false}
                    />
                  )}
                </Stack>
                {addModal}
                {editModal}
                {deleteModal}
                {alertInstancesModal}
              </>
            )}
            {muteTimingsTabActive && (
              <MuteTimingsTable alertManagerSourceName={selectedAlertmanager} hideActions={!hasConfigurationAPI} />
            )}
          </>
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
  let matchedRoutes: RouteWithID[][] = [];

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
  tabContent: css`
    margin-top: ${theme.spacing(2)};
  `,
});

interface QueryParamValues {
  tab: ActiveTab;
}

function getActiveTabFromUrl(queryParams: UrlQueryMap): QueryParamValues {
  let tab = ActiveTab.NotificationPolicies; // default tab

  if (queryParams['tab'] === ActiveTab.NotificationPolicies) {
    tab = ActiveTab.NotificationPolicies;
  }

  if (queryParams['tab'] === ActiveTab.MuteTimings) {
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
