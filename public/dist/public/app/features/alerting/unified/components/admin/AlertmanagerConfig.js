import { css } from '@emotion/css';
import React, { useState, useMemo } from 'react';
import { Alert, useStyles2 } from '@grafana/ui';
import { useDispatch } from 'app/types';
import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { deleteAlertManagerConfigAction, updateAlertManagerConfigAction } from '../../state/actions';
import { GRAFANA_RULES_SOURCE_NAME, isVanillaPrometheusAlertManagerDataSource } from '../../utils/datasource';
import AlertmanagerConfigSelector from './AlertmanagerConfigSelector';
import { ConfigEditor } from './ConfigEditor';
export default function AlertmanagerConfig() {
    const dispatch = useDispatch();
    const [showConfirmDeleteAMConfig, setShowConfirmDeleteAMConfig] = useState(false);
    const { loading: isDeleting } = useUnifiedAlertingSelector((state) => state.deleteAMConfig);
    const { loading: isSaving } = useUnifiedAlertingSelector((state) => state.saveAMConfig);
    const { selectedAlertmanager } = useAlertmanager();
    const readOnly = selectedAlertmanager ? isVanillaPrometheusAlertManagerDataSource(selectedAlertmanager) : false;
    const styles = useStyles2(getStyles);
    const [selectedAmConfig, setSelectedAmConfig] = useState();
    const { currentData: config, error: loadingError, isLoading: isLoadingConfig, } = useAlertmanagerConfig(selectedAlertmanager);
    const resetConfig = () => {
        if (selectedAlertmanager) {
            dispatch(deleteAlertManagerConfigAction(selectedAlertmanager));
        }
        setShowConfirmDeleteAMConfig(false);
    };
    const defaultValues = useMemo(() => ({
        configJSON: config ? JSON.stringify(config, null, 2) : '',
    }), [config]);
    const defaultValidValues = useMemo(() => ({
        configJSON: selectedAmConfig ? JSON.stringify(selectedAmConfig.value, null, 2) : '',
    }), [selectedAmConfig]);
    const loading = isDeleting || isLoadingConfig || isSaving;
    const onSubmit = (values) => {
        if (selectedAlertmanager && config) {
            dispatch(updateAlertManagerConfigAction({
                newConfig: JSON.parse(values.configJSON),
                oldConfig: config,
                alertManagerSourceName: selectedAlertmanager,
                successMessage: 'Alertmanager configuration updated.',
            }));
        }
    };
    return (React.createElement("div", { className: styles.container },
        loadingError && !loading && (React.createElement(React.Fragment, null,
            React.createElement(Alert, { severity: "error", title: "Your Alertmanager configuration is incorrect. These are the details of the error:" }, loadingError.message || 'Unknown error.'),
            selectedAlertmanager === GRAFANA_RULES_SOURCE_NAME && (React.createElement(AlertmanagerConfigSelector, { onChange: setSelectedAmConfig, selectedAmConfig: selectedAmConfig, defaultValues: defaultValidValues, readOnly: true, loading: loading, onSubmit: onSubmit })))),
        isDeleting && selectedAlertmanager !== GRAFANA_RULES_SOURCE_NAME && (React.createElement(Alert, { severity: "info", title: "Resetting Alertmanager configuration" }, "It might take a while...")),
        selectedAlertmanager && config && (React.createElement(ConfigEditor, { defaultValues: defaultValues, onSubmit: (values) => onSubmit(values), readOnly: readOnly, loading: loading, alertManagerSourceName: selectedAlertmanager, showConfirmDeleteAMConfig: showConfirmDeleteAMConfig, onReset: () => setShowConfirmDeleteAMConfig(true), onConfirmReset: resetConfig, onDismiss: () => setShowConfirmDeleteAMConfig(false) }))));
}
const getStyles = (theme) => ({
    container: css `
    margin-bottom: ${theme.spacing(4)};
  `,
});
//# sourceMappingURL=AlertmanagerConfig.js.map