import { defaults } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useAsyncFn } from 'react-use';

import { Alert, Button, Stack } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { Trans } from 'app/core/internationalization';
import { useContactPointsWithStatus } from 'app/features/alerting/unified/components/contact-points/useContactPoints';
import { AlertmanagerAction, useAlertmanagerAbility } from 'app/features/alerting/unified/hooks/useAbilities';
import { FormAmRoute } from 'app/features/alerting/unified/types/amroutes';
import { addUniqueIdentifierToRoute } from 'app/features/alerting/unified/utils/amroutes';
import { getErrorCode, stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';
import { computeInheritedTree } from 'app/features/alerting/unified/utils/notification-policies';
import { ObjectMatcher, ROUTES_META_SYMBOL, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { anyOfRequestState, isError } from '../../hooks/useAsync';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { ERROR_NEWER_CONFIGURATION } from '../../utils/k8s/errors';

import { alertmanagerApi } from './../../api/alertmanagerApi';
import { useGetContactPointsState } from './../../api/receiversApi';
import { useRouteGroupsMatcher } from './../../useRouteGroupsMatcher';
import { InsertPosition } from './../../utils/routeTree';
import { NotificationPoliciesFilter, findRoutesByMatchers, findRoutesMatchingPredicate } from './Filters';
import { useAddPolicyModal, useAlertGroupsModal, useDeletePolicyModal, useEditPolicyModal } from './Modals';
import { Policy } from './Policy';
import { TIMING_OPTIONS_DEFAULTS } from './timingOptions';
import {
  useAddNotificationPolicy,
  useDeleteNotificationPolicy,
  useNotificationPolicyRoute,
  useUpdateExistingNotificationPolicy,
} from './useNotificationPolicyRoute';

export const NotificationPoliciesList = () => {
  const appNotification = useAppNotification();
  const [contactPointsSupported, canSeeContactPoints] = useAlertmanagerAbility(AlertmanagerAction.ViewContactPoint);

  const [_, canSeeAlertGroups] = useAlertmanagerAbility(AlertmanagerAction.ViewAlertGroups);
  const { useGetAlertmanagerAlertGroupsQuery } = alertmanagerApi;

  const [contactPointFilter, setContactPointFilter] = useState<string | undefined>();
  const [labelMatchersFilter, setLabelMatchersFilter] = useState<ObjectMatcher[]>([]);

  const { selectedAlertmanager, hasConfigurationAPI, isGrafanaAlertmanager } = useAlertmanager();
  const { getRouteGroupsMap } = useRouteGroupsMatcher();

  const shouldFetchContactPoints = contactPointsSupported && canSeeContactPoints;
  const contactPointsState = useGetContactPointsState(
    // Workaround to not try and call this API when we don't have access to the policies tab
    shouldFetchContactPoints ? (selectedAlertmanager ?? '') : ''
  );

  const {
    currentData,
    isLoading,
    error: fetchPoliciesError,
    refetch: refetchNotificationPolicyRoute,
  } = useNotificationPolicyRoute({ alertmanager: selectedAlertmanager ?? '' });

  // We make the assumption that the first policy is the default one
  // At the time of writing, this will be always the case for the AM config response, and the K8S API
  // TODO in the future: Generalise the component to support any number of "root" policies
  const [defaultPolicy] = currentData ?? [];

  // deleting policies
  const [deleteNotificationPolicy, deleteNotificationPolicyState] = useDeleteNotificationPolicy({
    alertmanager: selectedAlertmanager ?? '',
  });

  // updating policies
  const [updateExistingNotificationPolicy, updateExistingNotificationPolicyState] = useUpdateExistingNotificationPolicy(
    {
      alertmanager: selectedAlertmanager ?? '',
    }
  );

  // adding new policies
  const [addNotificationPolicy, addNotificationPolicyState] = useAddNotificationPolicy({
    alertmanager: selectedAlertmanager ?? '',
  });

  const { currentData: alertGroups, refetch: refetchAlertGroups } = useGetAlertmanagerAlertGroupsQuery(
    { amSourceName: selectedAlertmanager ?? '' },
    { skip: !canSeeAlertGroups || !selectedAlertmanager }
  );

  const { contactPoints: receivers } = useContactPointsWithStatus({
    alertmanager: selectedAlertmanager ?? '',
    fetchPolicies: false,
    fetchStatuses: true,
    skip: !shouldFetchContactPoints,
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
    updateExistingNotificationPolicy.reset();
    deleteNotificationPolicy.reset();
    addNotificationPolicy.reset();
  };

  async function handleUpdate(partialRoute: Partial<FormAmRoute>) {
    await updateExistingNotificationPolicy.execute(partialRoute);
    handleActionResult({ error: updateExistingNotificationPolicyState.error });
  }

  async function handleDelete(route: RouteWithID) {
    await deleteNotificationPolicy.execute(route.id);
    handleActionResult({ error: deleteNotificationPolicyState.error });
  }

  async function handleAdd(
    partialRoute: Partial<FormAmRoute>,
    referenceRoute: RouteWithID,
    insertPosition: InsertPosition
  ) {
    await addNotificationPolicy.execute({
      partialRoute,
      referenceRouteIdentifier: referenceRoute.id,
      insertPosition,
    });
    handleActionResult({ error: addNotificationPolicyState.error });
  }

  function handleActionResult({ error }: { error?: Error }) {
    if (!error) {
      appNotification.success('Updated notification policies');
    }
    if (selectedAlertmanager) {
      refetchAlertGroups();
    }

    // close all modals
    closeEditModal();
    closeAddModal();
    closeDeleteModal();
  }

  const updatingTree = anyOfRequestState(
    updateExistingNotificationPolicyState,
    deleteNotificationPolicyState,
    addNotificationPolicyState
  ).loading;

  // edit, add, delete modals
  const [addModal, openAddModal, closeAddModal] = useAddPolicyModal(handleAdd, updatingTree);
  const [editModal, openEditModal, closeEditModal] = useEditPolicyModal(
    selectedAlertmanager ?? '',
    handleUpdate,
    updatingTree
  );
  const [deleteModal, openDeleteModal, closeDeleteModal] = useDeletePolicyModal(handleDelete, updatingTree);
  const [alertInstancesModal, showAlertGroupsModal] = useAlertGroupsModal(selectedAlertmanager ?? '');

  if (!selectedAlertmanager) {
    return null;
  }

  const hasPoliciesData = rootRoute && !fetchPoliciesError && !isLoading;
  const hasPoliciesError = Boolean(fetchPoliciesError) && !isLoading;
  const hasConflictError = [
    addNotificationPolicyState,
    updateExistingNotificationPolicyState,
    deleteNotificationPolicyState,
  ].some((state) => isError(state) && getErrorCode(state.error) === ERROR_NEWER_CONFIGURATION);

  return (
    <>
      {hasPoliciesError && (
        <Alert severity="error" title="Error loading Alertmanager config">
          {stringifyErrorLike(fetchPoliciesError) || 'Unknown error.'}
        </Alert>
      )}
      {/* show when there is an update error */}
      {hasConflictError && (
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
          <NotificationPoliciesFilter
            onChangeMatchers={setLabelMatchersFilter}
            onChangeReceiver={setContactPointFilter}
            matchingCount={routesMatchingFilters.matchedRoutesWithPath.size}
          />
          <Policy
            receivers={receivers}
            // add the timing defaults to the default policy to make sure child policies inherit properly
            currentRoute={defaults(rootRoute, TIMING_OPTIONS_DEFAULTS)}
            contactPointsState={contactPointsState.receivers}
            readOnly={!hasConfigurationAPI}
            provisioned={rootRoute[ROUTES_META_SYMBOL]?.provisioned}
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
        </Stack>
      )}
      {addModal}
      {editModal}
      {deleteModal}
      {alertInstancesModal}
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
