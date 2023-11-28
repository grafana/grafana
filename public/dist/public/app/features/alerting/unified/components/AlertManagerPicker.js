import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { InlineField, Select, useStyles2 } from '@grafana/ui';
import { useAlertmanager } from '../state/AlertmanagerContext';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
function getAlertManagerLabel(alertManager) {
    return alertManager.name === GRAFANA_RULES_SOURCE_NAME ? 'Grafana' : alertManager.name.slice(0, 37);
}
export const AlertManagerPicker = ({ disabled = false }) => {
    const styles = useStyles2(getStyles);
    const { selectedAlertmanager, availableAlertManagers, setSelectedAlertmanager } = useAlertmanager();
    const options = useMemo(() => {
        return availableAlertManagers.map((ds) => ({
            label: getAlertManagerLabel(ds),
            value: ds.name,
            imgUrl: ds.imgUrl,
            meta: ds.meta,
        }));
    }, [availableAlertManagers]);
    return (React.createElement(InlineField, { className: styles.field, label: disabled ? 'Alertmanager' : 'Choose Alertmanager', disabled: disabled || options.length === 1, "data-testid": "alertmanager-picker" },
        React.createElement(Select, { "aria-label": disabled ? 'Alertmanager' : 'Choose Alertmanager', width: 29, className: "ds-picker select-container", backspaceRemovesValue: false, onChange: (value) => {
                if (value === null || value === void 0 ? void 0 : value.value) {
                    setSelectedAlertmanager(value.value);
                }
            }, options: options, maxMenuHeight: 500, noOptionsMessage: "No datasources found", value: selectedAlertmanager, getOptionLabel: (o) => o.label })));
};
const getStyles = (theme) => ({
    field: css `
    margin: 0;
  `,
});
//# sourceMappingURL=AlertManagerPicker.js.map