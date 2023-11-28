import React, { useEffect } from 'react';
import { Route, Switch } from 'react-router-dom';
import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { useDispatch } from 'app/types';
import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { fetchGrafanaNotifiersAction } from '../../state/actions';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { GrafanaAlertmanagerDeliveryWarning } from '../GrafanaAlertmanagerDeliveryWarning';
import { DuplicateTemplateView } from '../receivers/DuplicateTemplateView';
import { EditReceiverView } from '../receivers/EditReceiverView';
import { EditTemplateView } from '../receivers/EditTemplateView';
import { GlobalConfigForm } from '../receivers/GlobalConfigForm';
import { NewReceiverView } from '../receivers/NewReceiverView';
import { NewTemplateView } from '../receivers/NewTemplateView';
import { ReceiversAndTemplatesView } from '../receivers/ReceiversAndTemplatesView';
const Receivers = () => {
    const { selectedAlertmanager: alertManagerSourceName } = useAlertmanager();
    const dispatch = useDispatch();
    const { currentData: config, isLoading: loading, error } = useAlertmanagerConfig(alertManagerSourceName);
    const receiverTypes = useUnifiedAlertingSelector((state) => state.grafanaNotifiers);
    useEffect(() => {
        if (alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME &&
            !(receiverTypes.result || receiverTypes.loading || receiverTypes.error)) {
            dispatch(fetchGrafanaNotifiersAction());
        }
    }, [alertManagerSourceName, dispatch, receiverTypes]);
    if (!alertManagerSourceName) {
        return null;
    }
    return (React.createElement(React.Fragment, null,
        error && !loading && (React.createElement(Alert, { severity: "error", title: "Error loading Alertmanager config" }, error.message || 'Unknown error.')),
        React.createElement(GrafanaAlertmanagerDeliveryWarning, { currentAlertmanager: alertManagerSourceName }),
        loading && !config && React.createElement(LoadingPlaceholder, { text: "loading configuration..." }),
        config && !error && (React.createElement(Switch, null,
            React.createElement(Route, { exact: true, path: "/alerting/notifications" },
                React.createElement(ReceiversAndTemplatesView, { config: config, alertManagerName: alertManagerSourceName })),
            React.createElement(Route, { exact: true, path: "/alerting/notifications/templates/new" },
                React.createElement(NewTemplateView, { config: config, alertManagerSourceName: alertManagerSourceName })),
            React.createElement(Route, { exact: true, path: "/alerting/notifications/templates/:name/duplicate" }, ({ match }) => (match === null || match === void 0 ? void 0 : match.params.name) && (React.createElement(DuplicateTemplateView, { alertManagerSourceName: alertManagerSourceName, config: config, templateName: decodeURIComponent(match === null || match === void 0 ? void 0 : match.params.name) }))),
            React.createElement(Route, { exact: true, path: "/alerting/notifications/templates/:name/edit" }, ({ match }) => (match === null || match === void 0 ? void 0 : match.params.name) && (React.createElement(EditTemplateView, { alertManagerSourceName: alertManagerSourceName, config: config, templateName: decodeURIComponent(match === null || match === void 0 ? void 0 : match.params.name) }))),
            React.createElement(Route, { exact: true, path: "/alerting/notifications/receivers/new" },
                React.createElement(NewReceiverView, { config: config, alertManagerSourceName: alertManagerSourceName })),
            React.createElement(Route, { exact: true, path: "/alerting/notifications/receivers/:name/edit" }, ({ match }) => (match === null || match === void 0 ? void 0 : match.params.name) && (React.createElement(EditReceiverView, { alertManagerSourceName: alertManagerSourceName, config: config, receiverName: decodeURIComponent(match === null || match === void 0 ? void 0 : match.params.name) }))),
            React.createElement(Route, { exact: true, path: "/alerting/notifications/global-config" },
                React.createElement(GlobalConfigForm, { config: config, alertManagerSourceName: alertManagerSourceName }))))));
};
export default Receivers;
//# sourceMappingURL=ContactPoints.v1.js.map