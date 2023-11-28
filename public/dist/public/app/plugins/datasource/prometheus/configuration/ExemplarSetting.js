import React, { useState } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Button, InlineField, Input, Switch, useTheme2 } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { docsTip, overhaulStyles, PROM_CONFIG_LABEL_WIDTH } from './ConfigEditor';
export default function ExemplarSetting({ value, onChange, onDelete, disabled }) {
    const [isInternalLink, setIsInternalLink] = useState(Boolean(value.datasourceUid));
    const theme = useTheme2();
    const styles = overhaulStyles(theme);
    return (React.createElement("div", { className: "gf-form-group" },
        React.createElement(InlineField, { label: "Internal link", labelWidth: PROM_CONFIG_LABEL_WIDTH, disabled: disabled, tooltip: React.createElement(React.Fragment, null,
                "Enable this option if you have an internal link. When enabled, this reveals the data source selector. Select the backend tracing data store for your exemplar data. ",
                docsTip()), interactive: true, className: styles.switchField },
            React.createElement(React.Fragment, null,
                React.createElement(Switch, { value: isInternalLink, "aria-label": selectors.components.DataSource.Prometheus.configPage.internalLinkSwitch, onChange: (ev) => setIsInternalLink(ev.currentTarget.checked) }))),
        isInternalLink ? (React.createElement(InlineField, { label: "Data source", labelWidth: PROM_CONFIG_LABEL_WIDTH, tooltip: React.createElement(React.Fragment, null,
                "The data source the exemplar is going to navigate to. ",
                docsTip()), disabled: disabled, interactive: true },
            React.createElement(DataSourcePicker, { tracing: true, current: value.datasourceUid, noDefault: true, width: 40, onChange: (ds) => onChange(Object.assign(Object.assign({}, value), { datasourceUid: ds.uid, url: undefined })) }))) : (React.createElement(InlineField, { label: "URL", labelWidth: PROM_CONFIG_LABEL_WIDTH, tooltip: React.createElement(React.Fragment, null,
                "The URL of the trace backend the user would go to see its trace. ",
                docsTip()), disabled: disabled, interactive: true },
            React.createElement(Input, { placeholder: "https://example.com/${__value.raw}", spellCheck: false, width: 40, value: value.url, onChange: (event) => onChange(Object.assign(Object.assign({}, value), { datasourceUid: undefined, url: event.currentTarget.value })) }))),
        React.createElement(InlineField, { label: "URL Label", labelWidth: PROM_CONFIG_LABEL_WIDTH, tooltip: React.createElement(React.Fragment, null,
                "Use to override the button label on the exemplar traceID field. ",
                docsTip()), disabled: disabled, interactive: true },
            React.createElement(Input, { placeholder: "Go to example.com", spellCheck: false, width: 40, value: value.urlDisplayLabel, onChange: (event) => onChange(Object.assign(Object.assign({}, value), { urlDisplayLabel: event.currentTarget.value })) })),
        React.createElement(InlineField, { label: "Label name", labelWidth: PROM_CONFIG_LABEL_WIDTH, tooltip: React.createElement(React.Fragment, null,
                "The name of the field in the labels object that should be used to get the traceID. ",
                docsTip()), disabled: disabled, interactive: true },
            React.createElement(Input, { placeholder: "traceID", spellCheck: false, width: 40, value: value.name, onChange: (event) => onChange(Object.assign(Object.assign({}, value), { name: event.currentTarget.value })) })),
        !disabled && (React.createElement(InlineField, { label: "Remove exemplar link", labelWidth: PROM_CONFIG_LABEL_WIDTH, disabled: disabled },
            React.createElement(Button, { variant: "destructive", title: "Remove exemplar link", icon: "times", onClick: (event) => {
                    event.preventDefault();
                    onDelete();
                } })))));
}
//# sourceMappingURL=ExemplarSetting.js.map