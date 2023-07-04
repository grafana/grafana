import { css } from '@emotion/css';
import { intersectionBy, isEqual } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useAsyncFn } from 'react-use';

import { GrafanaTheme2, UrlQueryMap } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Alert, LoadingPlaceholder, Tab, TabContent, TabsBar, useStyles2, withErrorBoundary } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { ObjectMatcher, Route, RouteWithID } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import { useCleanup } from '../../../core/hooks/useCleanup';

import { alertmanagerApi } from './api/alertmanagerApi';
import { useGetContactPointsState } from './api/receiversApi';
import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import { GrafanaAlertmanagerDeliveryWarning } from './components/GrafanaAlertmanagerDeliveryWarning';
import { ProvisionedResource, ProvisioningAlert } from './components/Provisioning';
import { MuteTimingsTable } from './components/mute-timings/MuteTimingsTable';
import {
  computeInheritedTree,
  findRoutesMatchingPredicate,
  NotificationPoliciesFilter,
} from './components/notification-policies/Filters';
import {
  useAddPolicyModal,
  useEditPolicyModal,
  useDeletePolicyModal,
  useAlertGroupsModal,
} from './components/notification-policies/Modals';
import { Policy } from './components/notification-policies/Policy';
import { useAlertmanagerConfig } from './hooks/useAlertmanagerConfig';
import { useAlertmanager } from './state/AlertmanagerContext';
import { updateAlertManagerConfigAction } from './state/actions';
import { FormAmRoute } from './types/amroutes';
import { useRouteGroupsMatcher } from './useRouteGroupsMatcher';
import { addUniqueIdentifierToRoute } from './utils/amroutes';
import { isVanillaPrometheusAlertManagerDataSource } from './utils/datasource';
import { normalizeMatchers } from './utils/matchers';
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

  const { getRouteGroupsMap } = useRouteGroupsMatcher();
  const { selectedAlertmanager } = useAlertmanager();

  const contactPointsState = useGetContactPointsState(selectedAlertmanager ?? '');

  const { result, config, loading: resultLoading, error: resultError } = useAlertmanagerConfig(selectedAlertmanager);

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
      triggerGetRouteGroupsMap(rootRoute, alertGroups);
    }
  }, [rootRoute, alertGroups, triggerGetRouteGroupsMap]);

  // these are computed from the contactPoint and labels matchers filter
  const routesMatchingFilters = useMemo(() => {
    if (!rootRoute) {
      return [];
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
        refetch: true,
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

  const vanillaPrometheusAlertManager = isVanillaPrometheusAlertManagerDataSource(selectedAlertmanager);
  const readOnlyPolicies = vanillaPrometheusAlertManager || isProvisioned;
  const readOnlyMuteTimings = vanillaPrometheusAlertManager;

  const numberOfMuteTimings = result?.alertmanager_config.mute_time_intervals?.length ?? 0;
  const haveData = result && !resultError && !resultLoading;
  const isLoading = !result && resultLoading;
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
        {isLoading && <LoadingPlaceholder text="Loading Alertmanager config..." />}
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
                {isProvisioned && <ProvisioningAlert resource={ProvisionedResource.RootNotificationPolicy} />}
                <Stack direction="column" gap={1}>
                  {rootRoute && (
                    <NotificationPoliciesFilter
                      receivers={receivers}
                      onChangeMatchers={setLabelMatchersFilter}
                      onChangeReceiver={setContactPointFilter}
                    />
                  )}
                  {rootRoute && (
                    <Policy
                      receivers={receivers}
                      routeTree={rootRoute}
                      currentRoute={rootRoute}
                      alertGroups={alertGroups ?? []}
                      contactPointsState={contactPointsState.receivers}
                      readOnly={readOnlyPolicies}
                      alertManagerSourceName={selectedAlertmanager}
                      onAddPolicy={openAddModal}
                      onEditPolicy={openEditModal}
                      onDeletePolicy={openDeleteModal}
                      onShowAlertInstances={showAlertGroupsModal}
                      routesMatchingFilters={routesMatchingFilters}
                      matchingInstancesPreview={{ groupsMap: routeAlertGroupsMap, enabled: !instancesPreviewError }}
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
              <MuteTimingsTable alertManagerSourceName={selectedAlertmanager} hideActions={readOnlyMuteTimings} />
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

export const findRoutesMatchingFilters = (rootRoute: RouteWithID, filters: RouteFilters): RouteWithID[] => {
  const { contactPointFilter, labelMatchersFilter = [] } = filters;

  let matchedRoutes: RouteWithID[][] = [];

  const fullRoute = computeInheritedTree(rootRoute);

  const routesMatchingContactPoint = contactPointFilter
    ? findRoutesMatchingPredicate(fullRoute, (route) => route.receiver === contactPointFilter)
    : undefined;

  if (routesMatchingContactPoint) {
    matchedRoutes.push(routesMatchingContactPoint);
  }

  const routesMatchingLabelMatchers = labelMatchersFilter.length
    ? findRoutesMatchingPredicate(fullRoute, (route) => {
        const routeMatchers = normalizeMatchers(route);
        return labelMatchersFilter.every((filter) => routeMatchers.some((matcher) => isEqual(filter, matcher)));
      })
    : undefined;

  if (routesMatchingLabelMatchers) {
    matchedRoutes.push(routesMatchingLabelMatchers);
  }

  return intersectionBy(...matchedRoutes, 'id');
};

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
  <AlertmanagerPageWrapper pageId="am-routes" accessType="notification">
    <AmRoutes />
  </AlertmanagerPageWrapper>
);

export default withErrorBoundary(NotificationPoliciesPage, { style: 'page' });
