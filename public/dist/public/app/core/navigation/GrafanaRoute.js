import React, { Suspense, useEffect, useLayoutEffect } from 'react';
// @ts-ignore
import Drop from 'tether-drop';
import { locationSearchToObject, navigationLogger, reportPageview } from '@grafana/runtime';
import { ErrorBoundary } from '@grafana/ui';
import { useGrafana } from '../context/GrafanaContext';
import { GrafanaRouteError } from './GrafanaRouteError';
import { GrafanaRouteLoading } from './GrafanaRouteLoading';
export function GrafanaRoute(props) {
    const { chrome, keybindings } = useGrafana();
    chrome.setMatchedRoute(props.route);
    useLayoutEffect(() => {
        keybindings.clearAndInitGlobalBindings(props.route);
    }, [keybindings, props.route]);
    useEffect(() => {
        updateBodyClassNames(props.route);
        cleanupDOM();
        navigationLogger('GrafanaRoute', false, 'Mounted', props.match);
        return () => {
            navigationLogger('GrafanaRoute', false, 'Unmounted', props.route);
            updateBodyClassNames(props.route, true);
        };
        // props.match instance change even though only query params changed so to make this effect only trigger on route mount we have to disable exhaustive-deps
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        cleanupDOM();
        reportPageview();
        navigationLogger('GrafanaRoute', false, 'Updated', props);
    });
    navigationLogger('GrafanaRoute', false, 'Rendered', props.route);
    return (React.createElement(ErrorBoundary, null, ({ error, errorInfo }) => {
        if (error) {
            return React.createElement(GrafanaRouteError, { error: error, errorInfo: errorInfo });
        }
        return (React.createElement(Suspense, { fallback: React.createElement(GrafanaRouteLoading, null) },
            React.createElement(props.route.component, Object.assign({}, props, { queryParams: locationSearchToObject(props.location.search) }))));
    }));
}
function getPageClasses(route) {
    return route.pageClass ? route.pageClass.split(' ') : [];
}
function updateBodyClassNames(route, clear = false) {
    for (const cls of getPageClasses(route)) {
        if (clear) {
            document.body.classList.remove(cls);
        }
        else {
            document.body.classList.add(cls);
        }
    }
}
function cleanupDOM() {
    var _a, _b;
    document.body.classList.remove('sidemenu-open--xs');
    // cleanup tooltips
    const tooltipById = document.getElementById('tooltip');
    (_a = tooltipById === null || tooltipById === void 0 ? void 0 : tooltipById.parentElement) === null || _a === void 0 ? void 0 : _a.removeChild(tooltipById);
    const tooltipsByClass = document.querySelectorAll('.tooltip');
    for (let i = 0; i < tooltipsByClass.length; i++) {
        const tooltip = tooltipsByClass[i];
        (_b = tooltip.parentElement) === null || _b === void 0 ? void 0 : _b.removeChild(tooltip);
    }
    // cleanup tether-drop
    for (const drop of Drop.drops) {
        drop.destroy();
    }
}
//# sourceMappingURL=GrafanaRoute.js.map