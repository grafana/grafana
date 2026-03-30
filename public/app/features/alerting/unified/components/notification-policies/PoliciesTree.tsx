import { defaults } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { computeInheritedTree } from '@grafana/alerting';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Stack } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useContactPointsWithStatus } from 'app/features/alerting/unified/components/contact-points/useContactPoints';
import { AlertmanagerAction, useAlertmanagerAbility } from 'app/features/alerting/unified/hooks/useAbilities';
import { type FormAmRoute } from 'app/features/alerting/unified/types/amroutes';
import { addUniqueIdentifierToRoute } from 'app/features/alerting/unified/utils/amroutes';
import { getErrorCode, stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';
import {
  type AlertmanagerGroup,
  type ObjectMatcher,
  ROUTES_META_SYMBOL,
  type RouteWithID,
} from 'app/plugins/datasource/alertmanager/types';

import { anyOfRequestState, isError } from '../../hooks/useAsync';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { type ContactPointsState } from '../../types/alerting';
import { CONTACT_POINTS_STATE_INTERVAL_MS } from '../../utils/constants';
import { ROOT_ROUTE_NAME } from '../../utils/k8s/constants';
import { ERROR_NEWER_CONFIGURATION } from '../../utils/k8s/errors';
import { routeAdapter } from '../../utils/routeAdapter';

import { alertmanagerApi } from './../../api/alertmanagerApi';
import { contactPointsStateDtoToModel } from './../../api/grafana';
import { type InsertPosition } from './../../utils/routeTree';
import { findRoutesByMatchers, findRoutesMatchingPredicate } from './Filters';
import { useAddPolicyModal, useAlertGroupsModal, useDeletePolicyModal, useEditPolicyModal } from './Modals';
import { Policy } from './Policy';
import { RoutesMatchingFiltersProvider } from './RoutesMatchingFiltersContext';
import { ResetModal } from './components/Modals';
import { TIMING_OPTIONS_DEFAULTS } from './timingOptions';
import {
  useAddNotificationPolicy,
  useDeleteNotificationPolicy,
  useDeleteRoutingTree,
  useNotificationPolicyRoute,
  useUpdateExistingNotificationPolicy,
} from './useNotificationPolicyRoute';
import { getAlertGroupsKey } from './utils';

/** Async function that computes route-to-alert-group mapping off the main thread. */
export type GetRouteGroupsMapFn = (
  rootRoute: RouteWithID,
  alertGroups: AlertmanagerGroup[],
  options?: { unquoteMatchers?: boolean }
) => Promise<Map<string, AlertmanagerGroup[]>>;

interface PoliciesTreeProps {
  routeName?: string;
  contactPointFilter?: string;
  labelMatchersFilter?: ObjectMatcher[];
  /** Whether policies default to expanded (true) or collapsed (false). Used with expandedOverrides. */
  defaultExpanded?: boolean;
  /** Set of policy IDs that override the defaultExpanded state. */
  expandedOverrides?: Set<string>;
  /** Called when a policy is toggled. When provided, the parent manages expand state. */
  onTogglePolicyExpanded?: (policyId: string) => void;
  /** Alert groups data for instance matching preview. When omitted, instance matching is disabled. */
  alertGroups?: AlertmanagerGroup[];
  /** Refetch alert groups after a policy mutation. */
  refetchAlertGroups?: () => void;
  /** Worker-based matching function (from useRouteGroupsMatcher). When omitted, instance matching is disabled. */
  getRouteGroupsMap?: GetRouteGroupsMapFn;
}

export const PoliciesTree = ({
  routeName,
  contactPointFilter,
  labelMatchersFilter,
  defaultExpanded,
  expandedOverrides,
  onTogglePolicyExpanded,
  alertGroups,
  refetchAlertGroups,
  getRouteGroupsMap,
}: PoliciesTreeProps) => {
  const appNotification = useAppNotification();
  const [contactPointsSupported, canSeeContactPoints] = useAlertmanagerAbility(AlertmanagerAction.ViewContactPoint);
  const [, canSeeAlertGroups] = useAlertmanagerAbility(AlertmanagerAction.ViewAlertGroups);

  const { selectedAlertmanager, isGrafanaAlertmanager, hasConfigurationAPI } = useAlertmanager();

  const shouldFetchContactPoints = contactPointsSupported && canSeeContactPoints;
  const { currentData: contactPointsStatusData } = alertmanagerApi.useGetContactPointsStatusQuery(undefined, {
    skip: !shouldFetchContactPoints,
    pollingInterval: CONTACT_POINTS_STATE_INTERVAL_MS,
  });
  const contactPointsState = useMemo<ContactPointsState>(() => {
    const emptyState = { receivers: {}, errorCount: 0 };
    return contactPointsStatusData ? contactPointsStateDtoToModel(contactPointsStatusData) : emptyState;
  }, [contactPointsStatusData]);

  const {
    currentData: defaultPolicy,
    isLoading,
    error: fetchPoliciesError,
    refetch: refetchNotificationPolicyRoute,
  } = useNotificationPolicyRoute({ alertmanager: selectedAlertmanager ?? '' }, routeName);

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

  // resetting the routing tree (used for the "Reset" action in the more dropdown)
  const [deleteRoutingTree] = useDeleteRoutingTree();
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetRoute, setResetRoute] = useState<RouteWithID | null>(null);

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
  const routeProvenance = defaultPolicy?.provenance;

  // Compute route-to-alert-group mapping via the worker.
  // Uses a ref-guard to avoid re-triggering when the async result causes a re-render.
  const [routeAlertGroupsMap, setRouteAlertGroupsMap] = useState<Map<string, AlertmanagerGroup[]> | undefined>();
  const [instancesPreviewError, setInstancesPreviewError] = useState<Error | undefined>();
  const matchingInputsRef = useRef<{ rootRouteId: string | undefined; alertGroupsKey: string | undefined }>({
    rootRouteId: undefined,
    alertGroupsKey: undefined,
  });

  const computeMatching = useCallback(async () => {
    if (!rootRoute || !alertGroups || !getRouteGroupsMap) {
      return;
    }
    const alertGroupsKey = getAlertGroupsKey(alertGroups);
    const inputKey = { rootRouteId: rootRoute.id, alertGroupsKey };
    // Skip if inputs haven't changed (prevents re-triggering after state update)
    if (
      matchingInputsRef.current.rootRouteId === inputKey.rootRouteId &&
      matchingInputsRef.current.alertGroupsKey === inputKey.alertGroupsKey
    ) {
      return;
    }
    matchingInputsRef.current = inputKey;

    try {
      const result = await getRouteGroupsMap(rootRoute, alertGroups, { unquoteMatchers: !isGrafanaAlertmanager });
      setRouteAlertGroupsMap(result);
      setInstancesPreviewError(undefined);
    } catch (error) {
      setInstancesPreviewError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [rootRoute, alertGroups, getRouteGroupsMap, isGrafanaAlertmanager]);

  useEffect(() => {
    computeMatching();
  }, [computeMatching]);

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
    await deleteNotificationPolicy.execute(route);
    handleActionResult({ error: deleteNotificationPolicyState.error });
  }

  async function handleAdd(
    partialRoute: Partial<FormAmRoute>,
    referenceRoute: RouteWithID,
    insertPosition: InsertPosition
  ) {
    await addNotificationPolicy.execute({
      partialRoute,
      referenceRoute: referenceRoute,
      insertPosition,
    });
    handleActionResult({ error: addNotificationPolicyState.error });
  }

  function handleResetPolicy(route: RouteWithID) {
    setResetRoute(route);
    setIsResetModalOpen(true);
  }

  function handleActionResult({ error }: { error?: Error }) {
    if (!error) {
      appNotification.success('Updated notification policies');
    }
    if (selectedAlertmanager && refetchAlertGroups) {
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
        <Alert
          severity="error"
          title={t(
            'alerting.notification-policies-list.title-error-loading-alertmanager-config',
            'Error loading Alertmanager config'
          )}
        >
          {stringifyErrorLike(fetchPoliciesError) || 'Unknown error.'}
        </Alert>
      )}
      {/* show when there is an update error */}
      {hasConflictError && (
        <Alert
          severity="info"
          title={t(
            'alerting.notification-policies-list.title-notification-policies-have-changed',
            'Notification policies have changed'
          )}
        >
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
          <RoutesMatchingFiltersProvider value={routesMatchingFilters}>
            {(!routesMatchingFilters.filtersApplied || routesMatchingFilters.matchedRoutesWithPath.size > 0) && (
              <Policy
                receivers={receivers}
                // add the timing defaults to the default policy to make sure child policies inherit properly
                currentRoute={defaults(rootRoute, TIMING_OPTIONS_DEFAULTS)}
                contactPointsState={contactPointsState.receivers}
                readOnly={!hasConfigurationAPI}
                provenance={routeProvenance}
                alertManagerSourceName={selectedAlertmanager}
                onAddPolicy={openAddModal}
                onEditPolicy={openEditModal}
                onDeletePolicy={openDeleteModal}
                onShowAlertInstances={showAlertGroupsModal}
                onResetPolicy={handleResetPolicy}
                matchingInstancesPreview={{
                  groupsMap: routeAlertGroupsMap,
                  enabled: Boolean(getRouteGroupsMap && canSeeAlertGroups && !instancesPreviewError),
                }}
                isAutoGenerated={false}
                isDefaultPolicy
                isActualDefaultPolicy={!routeName || routeName === ROOT_ROUTE_NAME}
                defaultExpanded={defaultExpanded}
                expandedOverrides={expandedOverrides}
                onTogglePolicyExpanded={onTogglePolicyExpanded}
              />
            )}
          </RoutesMatchingFiltersProvider>
        </Stack>
      )}
      {addModal}
      {editModal}
      {deleteModal}
      {alertInstancesModal}
      <ResetModal
        isOpen={isResetModalOpen}
        onConfirm={async () => {
          await deleteRoutingTree.execute({
            name: resetRoute?.[ROUTES_META_SYMBOL]?.name ?? resetRoute?.name ?? ROOT_ROUTE_NAME,
            resourceVersion: resetRoute?.[ROUTES_META_SYMBOL]?.resourceVersion,
          });
          refetchPolicies();
        }}
        onDismiss={() => {
          setIsResetModalOpen(false);
          setResetRoute(null);
        }}
        routeName={resetRoute?.[ROUTES_META_SYMBOL]?.name ?? resetRoute?.name ?? ''}
        isActualDefaultPolicy={!routeName || routeName === ROOT_ROUTE_NAME}
      />
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
  const adaptedRootRoute = routeAdapter.toPackage(rootRoute);
  const adaptedFullTree = computeInheritedTree(adaptedRootRoute);

  const fullRoute = routeAdapter.fromPackage(adaptedFullTree);

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
      result.set(key, matchingRoutes[0].get(key)!);
    }
  }

  return result;
}
