import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  Alert,
  Button,
  LoadingPlaceholder,
  Tab,
  TabContent,
  TabsBar,
  useStyles2,
  withErrorBoundary,
} from '@grafana/ui';
import { Route, RouteWithID } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import { useCleanup } from '../../../core/hooks/useCleanup';

import { alertmanagerApi } from './api/alertmanagerApi';
import { useGetContactPointsState } from './api/receiversApi';
import { AlertManagerPicker } from './components/AlertManagerPicker';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { GrafanaAlertmanagerDeliveryWarning } from './components/GrafanaAlertmanagerDeliveryWarning';
import { NoAlertManagerWarning } from './components/NoAlertManagerWarning';
import { ProvisionedResource, ProvisioningAlert } from './components/Provisioning';
import { Spacer } from './components/Spacer';
import { MuteTimingsTable } from './components/amroutes/MuteTimingsTable';
import { useAddPolicyModal, useEditPolicyModal, useDeletePolicyModal } from './components/notification-policies/Modals';
import { Policy } from './components/notification-policies/Policy';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useAlertManagersByPermission } from './hooks/useAlertManagerSources';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAlertGroupsAction, fetchAlertManagerConfigAction, updateAlertManagerConfigAction } from './state/actions';
import { FormAmRoute } from './types/amroutes';
import { addUniqueIdentifierToRoute, normalizeMatchers } from './utils/amroutes';
import { isVanillaPrometheusAlertManagerDataSource } from './utils/datasource';
import { initialAsyncRequestState } from './utils/redux';
import { addRouteToParentRoute, mergePartialAmRouteWithRouteTree, omitRouteFromRouteTree } from './utils/routeTree';

enum ActiveTab {
  NotificationPolicies,
  MuteTimings,
}

const AmRoutes = () => {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);
  // TODO add querystring param for the current tab so we can route to it immediately
  const [activeTab, setActiveTab] = useState<ActiveTab>(ActiveTab.NotificationPolicies);
  const [updatingTree, setUpdatingTree] = useState<boolean>(false);

  const { useGetAlertmanagerChoiceQuery } = alertmanagerApi;
  const { currentData: alertmanagerChoice } = useGetAlertmanagerChoiceQuery();

  const alertManagers = useAlertManagersByPermission('notification');
  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName(alertManagers);

  const amConfigs = useUnifiedAlertingSelector((state) => state.amConfigs);
  const contactPointsState = useGetContactPointsState(alertManagerSourceName ?? '');

  useEffect(() => {
    if (alertManagerSourceName) {
      dispatch(fetchAlertManagerConfigAction(alertManagerSourceName));
    }
  }, [alertManagerSourceName, dispatch]);

  const {
    result,
    loading: resultLoading,
    error: resultError,
  } = (alertManagerSourceName && amConfigs[alertManagerSourceName]) || initialAsyncRequestState;

  const config = result?.alertmanager_config;
  const receivers = config?.receivers ?? [];

  const rootRoute = useMemo(() => {
    if (config?.route) {
      return addUniqueIdentifierToRoute(config.route);
    }

    return;
  }, [config?.route]);

  const isProvisioned = Boolean(config?.route?.provenance);

  // const alertGroups = useUnifiedAlertingSelector((state) => state.amAlertGroups);
  // const fetchAlertGroups = alertGroups[alertManagerSourceName || ''] ?? initialAsyncRequestState;

  function handleSave(partialRoute: Partial<FormAmRoute>) {
    if (!rootRoute) {
      return;
    }
    const newRouteTree = mergePartialAmRouteWithRouteTree(alertManagerSourceName ?? '', partialRoute, rootRoute);
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

    const newRouteTree = addRouteToParentRoute(alertManagerSourceName ?? '', partialRoute, parentRoute, rootRoute);
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
        alertManagerSourceName: alertManagerSourceName!,
        successMessage: 'Updated notification policies',
        refetch: true,
      })
    )
      .unwrap()
      .then(() => {
        if (alertManagerSourceName) {
          dispatch(fetchAlertGroupsAction(alertManagerSourceName));
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
    alertManagerSourceName ?? '',
    receivers,
    handleSave,
    updatingTree
  );
  const [deleteModal, openDeleteModal, closeDeleteModal] = useDeletePolicyModal(handleDelete, updatingTree);

  useCleanup((state) => (state.unifiedAlerting.saveAMConfig = initialAsyncRequestState));

  // fetch AM instances grouping
  useEffect(() => {
    if (alertManagerSourceName) {
      dispatch(fetchAlertGroupsAction(alertManagerSourceName));
    }
  }, [alertManagerSourceName, dispatch]);

  if (!alertManagerSourceName) {
    return (
      <AlertingPageWrapper pageId="am-routes">
        <NoAlertManagerWarning availableAlertManagers={alertManagers} />
      </AlertingPageWrapper>
    );
  }

  const readOnly = alertManagerSourceName
    ? isVanillaPrometheusAlertManagerDataSource(alertManagerSourceName) || isProvisioned
    : true;

  const numberOfMuteTimings = result?.alertmanager_config.mute_time_intervals?.length ?? 0;
  const haveData = result && !resultError && !resultLoading;
  const isLoading = !result && resultLoading;
  const haveError = resultError && !resultLoading;

  const childPolicies = rootRoute?.routes ?? [];
  const matchers = normalizeMatchers(rootRoute ?? {});
  const timingOptions = {
    group_wait: rootRoute?.group_wait,
    group_interval: rootRoute?.group_interval,
    repeat_interval: rootRoute?.repeat_interval,
  };

  return (
    <AlertingPageWrapper pageId="am-routes">
      <AlertManagerPicker
        current={alertManagerSourceName}
        onChange={setAlertManagerSourceName}
        dataSources={alertManagers}
      />
      <TabsBar>
        <Tab
          label={'Notification Policies'}
          active={activeTab === ActiveTab.NotificationPolicies}
          onChangeTab={() => {
            setActiveTab(ActiveTab.NotificationPolicies);
          }}
        />
        <Tab
          label={'Mute Timings'}
          active={activeTab === ActiveTab.MuteTimings}
          counter={numberOfMuteTimings}
          onChangeTab={() => {
            setActiveTab(ActiveTab.MuteTimings);
          }}
        />
        <Spacer />
        {haveData && activeTab === ActiveTab.MuteTimings && <Button type="button">Add mute timing</Button>}
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
            {activeTab === ActiveTab.NotificationPolicies && (
              <>
                <GrafanaAlertmanagerDeliveryWarning
                  currentAlertmanager={alertManagerSourceName}
                  alertmanagerChoice={alertmanagerChoice}
                />
                {isProvisioned && <ProvisioningAlert resource={ProvisionedResource.RootNotificationPolicy} />}
                {rootRoute && haveData && (
                  <Policy
                    isDefault
                    receivers={receivers}
                    currentRoute={rootRoute}
                    contactPoint={rootRoute.receiver}
                    contactPointsState={contactPointsState.receivers}
                    groupBy={rootRoute.group_by}
                    timingOptions={timingOptions}
                    readOnly={readOnly}
                    matchers={matchers}
                    muteTimings={rootRoute.mute_time_intervals}
                    childPolicies={childPolicies}
                    continueMatching={rootRoute.continue}
                    alertManagerSourceName={alertManagerSourceName}
                    onAddPolicy={openAddModal}
                    onEditPolicy={openEditModal}
                    onDeletePolicy={openDeleteModal}
                  />
                )}
                {addModal}
                {editModal}
                {deleteModal}
              </>
            )}
            {activeTab === ActiveTab.MuteTimings && (
              <MuteTimingsTable alertManagerSourceName={alertManagerSourceName} />
            )}
          </>
        )}
      </TabContent>
    </AlertingPageWrapper>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  tabContent: css`
    margin-top: ${theme.spacing(2)};
  `,
});

export default withErrorBoundary(AmRoutes, { style: 'page' });
