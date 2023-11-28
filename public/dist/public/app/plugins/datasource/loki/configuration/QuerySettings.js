import React from 'react';
import { ConfigSubSection } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Badge, InlineField, InlineFieldRow, Input } from '@grafana/ui';
import { ConfigDescriptionLink } from 'app/core/components/ConfigDescriptionLink';
export const QuerySettings = (props) => {
    const { maxLines, onMaxLinedChange, predefinedOperations, onPredefinedOperationsChange } = props;
    return (React.createElement(ConfigSubSection, { title: "Queries", description: React.createElement(ConfigDescriptionLink, { description: "Additional options to customize your querying experience.", suffix: "loki/configure-loki-data-source/#queries", feature: "query settings" }) },
        React.createElement(InlineField, { label: "Maximum lines", htmlFor: "loki_config_maxLines", labelWidth: 22, tooltip: React.createElement(React.Fragment, null, "Loki queries must contain a limit of the maximum number of lines returned (default: 1000). Increase this limit to have a bigger result set for ad-hoc analysis. Decrease this limit if your browser becomes sluggish when displaying the log results.") },
            React.createElement(Input, { type: "number", id: "loki_config_maxLines", value: maxLines, onChange: (event) => onMaxLinedChange(event.currentTarget.value), width: 16, placeholder: "1000", spellCheck: false })),
        config.featureToggles.lokiPredefinedOperations && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Predefined operations", htmlFor: "loki_config_predefinedOperations", labelWidth: 22, tooltip: React.createElement(React.Fragment, null, 'Predefined operations are used as an initial state for your queries. They are useful, if you want to unpack, parse or format all log lines. Currently we support only log operations starting with |. For example: | unpack | line_format "{{.message}}".') },
                React.createElement(Input, { type: "string", id: "loki_config_predefinedOperations", value: predefinedOperations, onChange: (event) => onPredefinedOperationsChange(event.currentTarget.value), width: 40, placeholder: "| unpack | line_format", spellCheck: false })),
            React.createElement(InlineField, null,
                React.createElement(Badge, { text: "Experimental", color: "orange", icon: "exclamation-triangle", tooltip: "Predefined operations is an experimental feature that may change in the future." }))))));
};
//# sourceMappingURL=QuerySettings.js.map