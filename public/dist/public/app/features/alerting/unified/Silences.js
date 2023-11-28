import React, { useCallback, useEffect } from 'react';
import { Route, Switch } from 'react-router-dom';
import { Alert, withErrorBoundary } from '@grafana/ui';
import { useDispatch } from 'app/types';
import { featureDiscoveryApi } from './api/featureDiscoveryApi';
import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import { GrafanaAlertmanagerDeliveryWarning } from './components/GrafanaAlertmanagerDeliveryWarning';
import SilencesEditor from './components/silences/SilencesEditor';
import SilencesTable from './components/silences/SilencesTable';
import { useSilenceNavData } from './hooks/useSilenceNavData';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { useAlertmanager } from './state/AlertmanagerContext';
import { fetchAmAlertsAction, fetchSilencesAction } from './state/actions';
import { SILENCES_POLL_INTERVAL_MS } from './utils/constants';
import { initialAsyncRequestState } from './utils/redux';
const Silences = () => {
    var _a, _b, _c;
    const { selectedAlertmanager } = useAlertmanager();
    const dispatch = useDispatch();
    const silences = useUnifiedAlertingSelector((state) => state.silences);
    const alertsRequests = useUnifiedAlertingSelector((state) => state.amAlerts);
    const alertsRequest = selectedAlertmanager
        ? alertsRequests[selectedAlertmanager] || initialAsyncRequestState
        : undefined;
    const { currentData: amFeatures } = featureDiscoveryApi.useDiscoverAmFeaturesQuery({ amSourceName: selectedAlertmanager !== null && selectedAlertmanager !== void 0 ? selectedAlertmanager : '' }, { skip: !selectedAlertmanager });
    useEffect(() => {
        function fetchAll() {
            if (selectedAlertmanager) {
                dispatch(fetchSilencesAction(selectedAlertmanager));
                dispatch(fetchAmAlertsAction(selectedAlertmanager));
            }
        }
        fetchAll();
        const interval = setInterval(() => fetchAll, SILENCES_POLL_INTERVAL_MS);
        return () => {
            clearInterval(interval);
        };
    }, [selectedAlertmanager, dispatch]);
    const { result, loading, error } = (selectedAlertmanager && silences[selectedAlertmanager]) || initialAsyncRequestState;
    const getSilenceById = useCallback((id) => result && result.find((silence) => silence.id === id), [result]);
    const mimirLazyInitError = ((_a = error === null || error === void 0 ? void 0 : error.message) === null || _a === void 0 ? void 0 : _a.includes('the Alertmanager is not configured')) && (amFeatures === null || amFeatures === void 0 ? void 0 : amFeatures.lazyConfigInit);
    if (!selectedAlertmanager) {
        return null;
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(GrafanaAlertmanagerDeliveryWarning, { currentAlertmanager: selectedAlertmanager }),
        mimirLazyInitError && (React.createElement(Alert, { title: "The selected Alertmanager has no configuration", severity: "warning" }, "Create a new contact point to create a configuration using the default values or contact your administrator to set up the Alertmanager.")),
        error && !loading && !mimirLazyInitError && (React.createElement(Alert, { severity: "error", title: "Error loading silences" }, error.message || 'Unknown error.')),
        (alertsRequest === null || alertsRequest === void 0 ? void 0 : alertsRequest.error) && !(alertsRequest === null || alertsRequest === void 0 ? void 0 : alertsRequest.loading) && !mimirLazyInitError && (React.createElement(Alert, { severity: "error", title: "Error loading Alertmanager alerts" }, ((_b = alertsRequest.error) === null || _b === void 0 ? void 0 : _b.message) || 'Unknown error.')),
        result && !error && (React.createElement(Switch, null,
            React.createElement(Route, { exact: true, path: "/alerting/silences" },
                React.createElement(SilencesTable, { silences: result, alertManagerAlerts: (_c = alertsRequest === null || alertsRequest === void 0 ? void 0 : alertsRequest.result) !== null && _c !== void 0 ? _c : [], alertManagerSourceName: selectedAlertmanager })),
            React.createElement(Route, { exact: true, path: "/alerting/silence/new" },
                React.createElement(SilencesEditor, { alertManagerSourceName: selectedAlertmanager })),
            React.createElement(Route, { exact: true, path: "/alerting/silence/:id/edit" }, ({ match }) => {
                return ((match === null || match === void 0 ? void 0 : match.params.id) && (React.createElement(SilencesEditor, { silence: getSilenceById(match.params.id), alertManagerSourceName: selectedAlertmanager })));
            })))));
};
function SilencesPage() {
    const pageNav = useSilenceNavData();
    return (React.createElement(AlertmanagerPageWrapper, { pageId: "silences", pageNav: pageNav, accessType: "instance" },
        React.createElement(Silences, null)));
}
export default withErrorBoundary(SilencesPage, { style: 'page' });
//# sourceMappingURL=Silences.js.map