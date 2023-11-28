import React, { useCallback, useEffect, useState } from 'react';
import { Route, Redirect, Switch, useRouteMatch } from 'react-router-dom';
import { Alert } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import MuteTimingForm from './components/mute-timings/MuteTimingForm';
import { useAlertmanagerConfig } from './hooks/useAlertmanagerConfig';
import { useAlertmanager } from './state/AlertmanagerContext';
const MuteTimings = () => {
    const [queryParams] = useQueryParams();
    const { selectedAlertmanager } = useAlertmanager();
    const { currentData, isLoading, error } = useAlertmanagerConfig(selectedAlertmanager, {
        refetchOnFocus: true,
        refetchOnReconnect: true,
    });
    const config = currentData === null || currentData === void 0 ? void 0 : currentData.alertmanager_config;
    const getMuteTimingByName = useCallback((id) => {
        var _a, _b;
        const timing = (_a = config === null || config === void 0 ? void 0 : config.mute_time_intervals) === null || _a === void 0 ? void 0 : _a.find(({ name }) => name === id);
        if (timing) {
            const provenance = (_b = config === null || config === void 0 ? void 0 : config.muteTimeProvenances) === null || _b === void 0 ? void 0 : _b[timing.name];
            return Object.assign(Object.assign({}, timing), { provenance });
        }
        return timing;
    }, [config]);
    return (React.createElement(React.Fragment, null,
        error && !isLoading && !currentData && (React.createElement(Alert, { severity: "error", title: `Error loading Alertmanager config for ${selectedAlertmanager}` }, error.message || 'Unknown error.')),
        currentData && !error && (React.createElement(Switch, null,
            React.createElement(Route, { exact: true, path: "/alerting/routes/mute-timing/new" },
                React.createElement(MuteTimingForm, { loading: isLoading })),
            React.createElement(Route, { exact: true, path: "/alerting/routes/mute-timing/edit" }, () => {
                if (queryParams['muteName']) {
                    const muteTiming = getMuteTimingByName(String(queryParams['muteName']));
                    const provenance = muteTiming === null || muteTiming === void 0 ? void 0 : muteTiming.provenance;
                    return (React.createElement(MuteTimingForm, { loading: isLoading, muteTiming: muteTiming, showError: !muteTiming && !isLoading, provenance: provenance }));
                }
                return React.createElement(Redirect, { to: "/alerting/routes" });
            })))));
};
const MuteTimingsPage = () => {
    const pageNav = useMuteTimingNavData();
    return (React.createElement(AlertmanagerPageWrapper, { pageId: "am-routes", pageNav: pageNav, accessType: "notification" },
        React.createElement(MuteTimings, null)));
};
export function useMuteTimingNavData() {
    const { isExact, path } = useRouteMatch();
    const [pageNav, setPageNav] = useState();
    useEffect(() => {
        if (path === '/alerting/routes/mute-timing/new') {
            setPageNav({
                id: 'alert-policy-new',
                text: 'Add mute timing',
            });
        }
        else if (path === '/alerting/routes/mute-timing/edit') {
            setPageNav({
                id: 'alert-policy-edit',
                text: 'Edit mute timing',
            });
        }
    }, [path, isExact]);
    return pageNav;
}
export default MuteTimingsPage;
//# sourceMappingURL=MuteTimings.js.map