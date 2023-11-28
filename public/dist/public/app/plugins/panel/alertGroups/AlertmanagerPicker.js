import React, { useMemo } from 'react';
import { Select } from '@grafana/ui';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
function getAlertManagerLabel(alertManager) {
    return alertManager.name === GRAFANA_RULES_SOURCE_NAME ? 'Grafana' : alertManager.name.slice(0, 37);
}
export const AlertManagerPicker = ({ onChange, current, dataSources }) => {
    const options = useMemo(() => {
        return dataSources.map((ds) => ({
            label: getAlertManagerLabel(ds),
            value: ds.name,
            imgUrl: ds.imgUrl,
            meta: ds.meta,
        }));
    }, [dataSources]);
    return (React.createElement(Select, { "aria-label": 'Choose Alertmanager', width: 29, backspaceRemovesValue: false, onChange: (value) => value.value && onChange(value.value), options: options, maxMenuHeight: 500, noOptionsMessage: "No datasources found", value: current, getOptionLabel: (o) => o.label }));
};
//# sourceMappingURL=AlertmanagerPicker.js.map