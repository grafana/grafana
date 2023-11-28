import React, { lazy, Suspense, useMemo, useState } from 'react';
import { PluginExtensionPoints, getTimeZone } from '@grafana/data';
import { getPluginLinkExtensions, config } from '@grafana/runtime';
import { Dropdown, ToolbarButton } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction, useSelector } from 'app/types';
import { getExploreItemSelector, isLeftPaneSelector, selectCorrelationDetails } from '../state/selectors';
import { ConfirmNavigationModal } from './ConfirmNavigationModal';
import { ToolbarExtensionPointMenu } from './ToolbarExtensionPointMenu';
const AddToDashboard = lazy(() => import('./AddToDashboard').then(({ AddToDashboard }) => ({ default: AddToDashboard })));
export function ToolbarExtensionPoint(props) {
    var _a, _b;
    const { exploreId, splitted } = props;
    const [selectedExtension, setSelectedExtension] = useState();
    const [isOpen, setIsOpen] = useState(false);
    const context = useExtensionPointContext(props);
    const extensions = useExtensionLinks(context);
    const selectExploreItem = getExploreItemSelector(exploreId);
    const noQueriesInPane = (_b = (_a = useSelector(selectExploreItem)) === null || _a === void 0 ? void 0 : _a.queries) === null || _b === void 0 ? void 0 : _b.length;
    // If we only have the explore core extension point registered we show the old way of
    // adding a query to a dashboard.
    if (extensions.length <= 1) {
        const canAddPanelToDashboard = contextSrv.hasPermission(AccessControlAction.DashboardsCreate) ||
            contextSrv.hasPermission(AccessControlAction.DashboardsWrite);
        if (!canAddPanelToDashboard) {
            return null;
        }
        return (React.createElement(Suspense, { fallback: null },
            React.createElement(AddToDashboard, { exploreId: exploreId })));
    }
    const menu = React.createElement(ToolbarExtensionPointMenu, { extensions: extensions, onSelect: setSelectedExtension });
    return (React.createElement(React.Fragment, null,
        React.createElement(Dropdown, { onVisibleChange: setIsOpen, placement: "bottom-start", overlay: menu },
            React.createElement(ToolbarButton, { "aria-label": "Add", icon: "plus", disabled: !Boolean(noQueriesInPane), variant: "canvas", isOpen: isOpen }, splitted ? ' ' : 'Add')),
        !!selectedExtension && !!selectedExtension.path && (React.createElement(ConfirmNavigationModal, { path: selectedExtension.path, title: selectedExtension.title, onDismiss: () => setSelectedExtension(undefined) }))));
}
function useExtensionPointContext(props) {
    const { exploreId, timeZone } = props;
    const isCorrelationDetails = useSelector(selectCorrelationDetails);
    const isCorrelationsEditorMode = (isCorrelationDetails === null || isCorrelationDetails === void 0 ? void 0 : isCorrelationDetails.editorMode) || false;
    const { queries, queryResponse, range } = useSelector(getExploreItemSelector(exploreId));
    const isLeftPane = useSelector(isLeftPaneSelector(exploreId));
    const datasourceUids = queries.map((query) => { var _a; return (_a = query === null || query === void 0 ? void 0 : query.datasource) === null || _a === void 0 ? void 0 : _a.uid; }).filter((uid) => uid !== undefined);
    const numUniqueIds = [...new Set(datasourceUids)].length;
    const canWriteCorrelations = contextSrv.hasPermission(AccessControlAction.DataSourcesWrite);
    return useMemo(() => {
        return {
            exploreId,
            targets: queries,
            data: queryResponse,
            timeRange: range.raw,
            timeZone: getTimeZone({ timeZone }),
            shouldShowAddCorrelation: config.featureToggles.correlations === true &&
                canWriteCorrelations &&
                !isCorrelationsEditorMode &&
                isLeftPane &&
                numUniqueIds === 1,
        };
    }, [
        exploreId,
        queries,
        queryResponse,
        range.raw,
        timeZone,
        canWriteCorrelations,
        isCorrelationsEditorMode,
        isLeftPane,
        numUniqueIds,
    ]);
}
function useExtensionLinks(context) {
    return useMemo(() => {
        const { extensions } = getPluginLinkExtensions({
            extensionPointId: PluginExtensionPoints.ExploreToolbarAction,
            context: context,
            limitPerPlugin: 3,
        });
        return extensions;
    }, [context]);
}
//# sourceMappingURL=ToolbarExtensionPoint.js.map