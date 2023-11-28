import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { dateTime } from '@grafana/data';
import { Button, HorizontalGroup, Select, useStyles2 } from '@grafana/ui';
import { alertmanagerApi } from '../../api/alertmanagerApi';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { ConfigEditor } from './ConfigEditor';
export default function AlertmanagerConfigSelector({ onChange, selectedAmConfig, defaultValues, onSubmit, readOnly, loading, }) {
    const { useGetValidAlertManagersConfigQuery, useResetAlertManagerConfigToOldVersionMutation } = alertmanagerApi;
    const styles = useStyles2(getStyles);
    const { currentData: validAmConfigs, isLoading: isFetchingValidAmConfigs } = useGetValidAlertManagersConfigQuery();
    const [resetAlertManagerConfigToOldVersion] = useResetAlertManagerConfigToOldVersionMutation();
    const validAmConfigsOptions = useMemo(() => {
        if (!(validAmConfigs === null || validAmConfigs === void 0 ? void 0 : validAmConfigs.length)) {
            return [];
        }
        const configs = validAmConfigs.map((config) => {
            const date = new Date(config.last_applied);
            return {
                label: config.last_applied
                    ? `Config from ${date.toLocaleString()} (${dateTime(date).locale('en').fromNow(true)} ago)`
                    : 'Previous config',
                value: config,
            };
        });
        onChange(configs[0]);
        return configs;
    }, [validAmConfigs, onChange]);
    const onResetClick = () => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const id = (_a = selectedAmConfig === null || selectedAmConfig === void 0 ? void 0 : selectedAmConfig.value) === null || _a === void 0 ? void 0 : _a.id;
        if (id === undefined) {
            return;
        }
        resetAlertManagerConfigToOldVersion({ id });
    });
    return (React.createElement(React.Fragment, null, !isFetchingValidAmConfigs && validAmConfigs && validAmConfigs.length > 0 ? (React.createElement(React.Fragment, null,
        React.createElement("div", null, "Select a previous working configuration until you fix this error:"),
        React.createElement("div", { className: styles.container },
            React.createElement(HorizontalGroup, { align: "flex-start", spacing: "md" },
                React.createElement(Select, { options: validAmConfigsOptions, value: selectedAmConfig, onChange: (value) => {
                        onChange(value);
                    } }),
                React.createElement(Button, { variant: "primary", disabled: loading, onClick: onResetClick }, "Reset to selected configuration"))),
        React.createElement(ConfigEditor, { defaultValues: defaultValues, onSubmit: (values) => onSubmit(values), readOnly: readOnly, loading: loading, alertManagerSourceName: GRAFANA_RULES_SOURCE_NAME }))) : null));
}
const getStyles = (theme) => ({
    container: css `
    margin-top: ${theme.spacing(2)};
    margin-bottom: ${theme.spacing(2)};
  `,
});
//# sourceMappingURL=AlertmanagerConfigSelector.js.map