import { __awaiter } from "tslib";
// Libraries
import { createSlice } from '@reduxjs/toolkit';
import React, { useCallback, useEffect, useMemo, useReducer } from 'react';
import { useLocation, useRouteMatch } from 'react-router-dom';
import { AppEvents, OrgRole, PluginType } from '@grafana/data';
import { config, locationSearchToObject } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { appEvents, contextSrv } from 'app/core/core';
import { getNotFoundNav, getWarningNav, getExceptionNav } from 'app/core/navigation/errorModels';
import { getPluginSettings } from '../pluginSettings';
import { importAppPlugin } from '../plugin_loader';
import { buildPluginSectionNav } from '../utils';
import { buildPluginPageContext, PluginPageContext } from './PluginPageContext';
const initialState = { loading: true, pluginNav: null, plugin: null };
export function AppRootPage({ pluginId, pluginNavSection }) {
    const match = useRouteMatch();
    const location = useLocation();
    const [state, dispatch] = useReducer(stateSlice.reducer, initialState);
    const currentUrl = config.appSubUrl + location.pathname + location.search;
    const { plugin, loading, pluginNav } = state;
    const navModel = buildPluginSectionNav(pluginNavSection, pluginNav, currentUrl);
    const queryParams = useMemo(() => locationSearchToObject(location.search), [location.search]);
    const context = useMemo(() => buildPluginPageContext(navModel), [navModel]);
    const grafanaContext = useGrafana();
    useEffect(() => {
        loadAppPlugin(pluginId, dispatch);
    }, [pluginId]);
    const onNavChanged = useCallback((newPluginNav) => dispatch(stateSlice.actions.changeNav(newPluginNav)), []);
    if (!plugin || pluginId !== plugin.meta.id) {
        // Use current layout while loading to reduce flickering
        const currentLayout = grafanaContext.chrome.state.getValue().layout;
        return (React.createElement(Page, { navModel: navModel, pageNav: { text: '' }, layout: currentLayout }, loading && React.createElement(PageLoader, null)));
    }
    if (!plugin.root) {
        return (React.createElement(Page, { navModel: navModel !== null && navModel !== void 0 ? navModel : getWarningNav('Plugin load error') },
            React.createElement("div", null, "No root app page component found")));
    }
    const pluginRoot = plugin.root && (React.createElement(plugin.root, { meta: plugin.meta, basename: match.url, onNavChanged: onNavChanged, query: queryParams, path: location.pathname }));
    // Because of the fallback at plugin routes, we need to check
    // if the user has permissions to see the plugin page.
    const userHasPermissionsToPluginPage = () => {
        var _a, _b;
        // Check if plugin does not have any configurations or the user is Grafana Admin
        if (!((_a = plugin.meta) === null || _a === void 0 ? void 0 : _a.includes) || contextSrv.isGrafanaAdmin || contextSrv.user.orgRole === OrgRole.Admin) {
            return true;
        }
        const pluginInclude = (_b = plugin.meta) === null || _b === void 0 ? void 0 : _b.includes.find((include) => include.path === pluginRoot.props.path);
        // Check if include configuration contains current path
        if (!pluginInclude) {
            return true;
        }
        const pathRole = (pluginInclude === null || pluginInclude === void 0 ? void 0 : pluginInclude.role) || '';
        // Check if role exists  and give access to Editor to be able to see Viewer pages
        if (!pathRole || (contextSrv.isEditor && pathRole === OrgRole.Viewer)) {
            return true;
        }
        return contextSrv.hasRole(pathRole);
    };
    const AccessDenied = () => {
        return (React.createElement(Alert, { severity: "warning", title: "Access denied" }, "You do not have permission to see this page."));
    };
    if (!userHasPermissionsToPluginPage()) {
        return React.createElement(AccessDenied, null);
    }
    if (!pluginNav) {
        return React.createElement(PluginPageContext.Provider, { value: context }, pluginRoot);
    }
    return (React.createElement(React.Fragment, null, navModel ? (React.createElement(Page, { navModel: navModel, pageNav: pluginNav === null || pluginNav === void 0 ? void 0 : pluginNav.node },
        React.createElement(Page.Contents, { isLoading: loading }, pluginRoot))) : (React.createElement(Page, null, pluginRoot))));
}
const stateSlice = createSlice({
    name: 'prom-builder-container',
    initialState: initialState,
    reducers: {
        setState: (state, action) => {
            Object.assign(state, action.payload);
        },
        changeNav: (state, action) => {
            let pluginNav = action.payload;
            // This is to hide the double breadcrumbs the old nav model can cause
            if (pluginNav && pluginNav.node.children) {
                pluginNav = Object.assign(Object.assign({}, pluginNav), { node: Object.assign(Object.assign({}, pluginNav.main), { hideFromBreadcrumbs: true }) });
            }
            state.pluginNav = pluginNav;
        },
    },
});
function loadAppPlugin(pluginId, dispatch) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const app = yield getPluginSettings(pluginId).then((info) => {
                const error = getAppPluginPageError(info);
                if (error) {
                    appEvents.emit(AppEvents.alertError, [error]);
                    dispatch(stateSlice.actions.setState({ pluginNav: getWarningNav(error) }));
                    return null;
                }
                return importAppPlugin(info);
            });
            dispatch(stateSlice.actions.setState({ plugin: app, loading: false, pluginNav: null }));
        }
        catch (err) {
            dispatch(stateSlice.actions.setState({
                plugin: null,
                loading: false,
                pluginNav: process.env.NODE_ENV === 'development' ? getExceptionNav(err) : getNotFoundNav(),
            }));
        }
    });
}
export function getAppPluginPageError(meta) {
    if (!meta) {
        return 'Unknown Plugin';
    }
    if (meta.type !== PluginType.app) {
        return 'Plugin must be an app';
    }
    if (!meta.enabled) {
        return 'Application Not Enabled';
    }
    return null;
}
export default AppRootPage;
//# sourceMappingURL=AppRootPage.js.map