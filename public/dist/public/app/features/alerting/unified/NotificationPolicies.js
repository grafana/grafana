import { css } from '@emotion/css';
import { intersectionBy, isEqual } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useAsyncFn } from 'react-use';
import { Stack } from '@grafana/experimental';
import { Alert, LoadingPlaceholder, Tab, TabContent, TabsBar, useStyles2, withErrorBoundary } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { useDispatch } from 'app/types';
import { useCleanup } from '../../../core/hooks/useCleanup';
import { alertmanagerApi } from './api/alertmanagerApi';
import { useGetContactPointsState } from './api/receiversApi';
import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import { GrafanaAlertmanagerDeliveryWarning } from './components/GrafanaAlertmanagerDeliveryWarning';
import { MuteTimingsTable } from './components/mute-timings/MuteTimingsTable';
import { findRoutesMatchingPredicate, NotificationPoliciesFilter } from './components/notification-policies/Filters';
import { useAddPolicyModal, useEditPolicyModal, useDeletePolicyModal, useAlertGroupsModal, } from './components/notification-policies/Modals';
import { Policy } from './components/notification-policies/Policy';
import { useAlertmanagerConfig } from './hooks/useAlertmanagerConfig';
import { useAlertmanager } from './state/AlertmanagerContext';
import { updateAlertManagerConfigAction } from './state/actions';
import { useRouteGroupsMatcher } from './useRouteGroupsMatcher';
import { addUniqueIdentifierToRoute } from './utils/amroutes';
import { normalizeMatchers } from './utils/matchers';
import { computeInheritedTree } from './utils/notification-policies';
import { initialAsyncRequestState } from './utils/redux';
import { addRouteToParentRoute, mergePartialAmRouteWithRouteTree, omitRouteFromRouteTree } from './utils/routeTree';
var ActiveTab;
(function (ActiveTab) {
    ActiveTab["NotificationPolicies"] = "notification_policies";
    ActiveTab["MuteTimings"] = "mute_timings";
})(ActiveTab || (ActiveTab = {}));
const AmRoutes = () => {
    var _a, _b, _c, _d;
    const dispatch = useDispatch();
    const styles = useStyles2(getStyles);
    const { useGetAlertmanagerAlertGroupsQuery } = alertmanagerApi;
    const [queryParams, setQueryParams] = useQueryParams();
    const { tab } = getActiveTabFromUrl(queryParams);
    const [activeTab, setActiveTab] = useState(tab);
    const [updatingTree, setUpdatingTree] = useState(false);
    const [contactPointFilter, setContactPointFilter] = useState();
    const [labelMatchersFilter, setLabelMatchersFilter] = useState([]);
    const { getRouteGroupsMap } = useRouteGroupsMatcher();
    const { selectedAlertmanager, hasConfigurationAPI } = useAlertmanager();
    const contactPointsState = useGetContactPointsState(selectedAlertmanager !== null && selectedAlertmanager !== void 0 ? selectedAlertmanager : '');
    const { currentData: result, isLoading: resultLoading, error: resultError, } = useAlertmanagerConfig(selectedAlertmanager, {
        refetchOnFocus: true,
        refetchOnReconnect: true,
    });
    const config = result === null || result === void 0 ? void 0 : result.alertmanager_config;
    const { currentData: alertGroups, refetch: refetchAlertGroups } = useGetAlertmanagerAlertGroupsQuery({ amSourceName: selectedAlertmanager !== null && selectedAlertmanager !== void 0 ? selectedAlertmanager : '' }, { skip: !selectedAlertmanager });
    const receivers = (_a = config === null || config === void 0 ? void 0 : config.receivers) !== null && _a !== void 0 ? _a : [];
    const rootRoute = useMemo(() => {
        if (config === null || config === void 0 ? void 0 : config.route) {
            return addUniqueIdentifierToRoute(config.route);
        }
        return;
    }, [config === null || config === void 0 ? void 0 : config.route]);
    // useAsync could also work but it's hard to wait until it's done in the tests
    // Combining with useEffect gives more predictable results because the condition is in useEffect
    const [{ value: routeAlertGroupsMap, error: instancesPreviewError }, triggerGetRouteGroupsMap] = useAsyncFn(getRouteGroupsMap, [getRouteGroupsMap]);
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
    const isProvisioned = Boolean((_b = config === null || config === void 0 ? void 0 : config.route) === null || _b === void 0 ? void 0 : _b.provenance);
    function handleSave(partialRoute) {
        if (!rootRoute) {
            return;
        }
        const newRouteTree = mergePartialAmRouteWithRouteTree(selectedAlertmanager !== null && selectedAlertmanager !== void 0 ? selectedAlertmanager : '', partialRoute, rootRoute);
        updateRouteTree(newRouteTree);
    }
    function handleDelete(route) {
        if (!rootRoute) {
            return;
        }
        const newRouteTree = omitRouteFromRouteTree(route, rootRoute);
        updateRouteTree(newRouteTree);
    }
    function handleAdd(partialRoute, parentRoute) {
        if (!rootRoute) {
            return;
        }
        const newRouteTree = addRouteToParentRoute(selectedAlertmanager !== null && selectedAlertmanager !== void 0 ? selectedAlertmanager : '', partialRoute, parentRoute, rootRoute);
        updateRouteTree(newRouteTree);
    }
    function updateRouteTree(routeTree) {
        if (!result) {
            return;
        }
        setUpdatingTree(true);
        dispatch(updateAlertManagerConfigAction({
            newConfig: Object.assign(Object.assign({}, result), { alertmanager_config: Object.assign(Object.assign({}, result.alertmanager_config), { route: routeTree }) }),
            oldConfig: result,
            alertManagerSourceName: selectedAlertmanager,
            successMessage: 'Updated notification policies',
        }))
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
    const [editModal, openEditModal, closeEditModal] = useEditPolicyModal(selectedAlertmanager !== null && selectedAlertmanager !== void 0 ? selectedAlertmanager : '', receivers, handleSave, updatingTree);
    const [deleteModal, openDeleteModal, closeDeleteModal] = useDeletePolicyModal(handleDelete, updatingTree);
    const [alertInstancesModal, showAlertGroupsModal] = useAlertGroupsModal();
    useCleanup((state) => (state.unifiedAlerting.saveAMConfig = initialAsyncRequestState));
    if (!selectedAlertmanager) {
        return null;
    }
    const numberOfMuteTimings = (_d = (_c = result === null || result === void 0 ? void 0 : result.alertmanager_config.mute_time_intervals) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 0;
    const haveData = result && !resultError && !resultLoading;
    const isFetching = !result && resultLoading;
    const haveError = resultError && !resultLoading;
    const muteTimingsTabActive = activeTab === ActiveTab.MuteTimings;
    const policyTreeTabActive = activeTab === ActiveTab.NotificationPolicies;
    return (React.createElement(React.Fragment, null,
        React.createElement(TabsBar, null,
            React.createElement(Tab, { label: 'Notification Policies', active: policyTreeTabActive, onChangeTab: () => {
                    setActiveTab(ActiveTab.NotificationPolicies);
                    setQueryParams({ tab: ActiveTab.NotificationPolicies });
                } }),
            React.createElement(Tab, { label: 'Mute Timings', active: muteTimingsTabActive, counter: numberOfMuteTimings, onChangeTab: () => {
                    setActiveTab(ActiveTab.MuteTimings);
                    setQueryParams({ tab: ActiveTab.MuteTimings });
                } })),
        React.createElement(TabContent, { className: styles.tabContent },
            isFetching && React.createElement(LoadingPlaceholder, { text: "Loading Alertmanager config..." }),
            haveError && (React.createElement(Alert, { severity: "error", title: "Error loading Alertmanager config" }, resultError.message || 'Unknown error.')),
            haveData && (React.createElement(React.Fragment, null,
                policyTreeTabActive && (React.createElement(React.Fragment, null,
                    React.createElement(GrafanaAlertmanagerDeliveryWarning, { currentAlertmanager: selectedAlertmanager }),
                    React.createElement(Stack, { direction: "column", gap: 1 },
                        rootRoute && (React.createElement(NotificationPoliciesFilter, { receivers: receivers, onChangeMatchers: setLabelMatchersFilter, onChangeReceiver: setContactPointFilter })),
                        rootRoute && (React.createElement(Policy, { receivers: receivers, routeTree: rootRoute, currentRoute: rootRoute, alertGroups: alertGroups !== null && alertGroups !== void 0 ? alertGroups : [], contactPointsState: contactPointsState.receivers, readOnly: !hasConfigurationAPI, provisioned: isProvisioned, alertManagerSourceName: selectedAlertmanager, onAddPolicy: openAddModal, onEditPolicy: openEditModal, onDeletePolicy: openDeleteModal, onShowAlertInstances: showAlertGroupsModal, routesMatchingFilters: routesMatchingFilters, matchingInstancesPreview: { groupsMap: routeAlertGroupsMap, enabled: !instancesPreviewError } }))),
                    addModal,
                    editModal,
                    deleteModal,
                    alertInstancesModal)),
                muteTimingsTabActive && (React.createElement(MuteTimingsTable, { alertManagerSourceName: selectedAlertmanager, hideActions: !hasConfigurationAPI })))))));
};
export const findRoutesMatchingFilters = (rootRoute, filters) => {
    const { contactPointFilter, labelMatchersFilter = [] } = filters;
    let matchedRoutes = [];
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
const getStyles = (theme) => ({
    tabContent: css `
    margin-top: ${theme.spacing(2)};
  `,
});
function getActiveTabFromUrl(queryParams) {
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
const NotificationPoliciesPage = () => (React.createElement(AlertmanagerPageWrapper, { pageId: "am-routes", accessType: "notification" },
    React.createElement(AmRoutes, null)));
export default withErrorBoundary(NotificationPoliciesPage, { style: 'page' });
//# sourceMappingURL=NotificationPolicies.js.map