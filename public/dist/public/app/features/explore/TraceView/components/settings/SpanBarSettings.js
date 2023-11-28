import { css } from '@emotion/css';
import React from 'react';
import { toOption, updateDatasourcePluginJsonDataOption, } from '@grafana/data';
import { ConfigSubSection } from '@grafana/experimental';
import { InlineField, InlineFieldRow, Input, Select, useStyles2 } from '@grafana/ui';
import { ConfigDescriptionLink } from 'app/core/components/ConfigDescriptionLink';
export const NONE = 'None';
export const DURATION = 'Duration';
export const TAG = 'Tag';
export default function SpanBarSettings({ options, onOptionsChange }) {
    var _a, _b, _c;
    const styles = useStyles2(getStyles);
    const selectOptions = [NONE, DURATION, TAG].map(toOption);
    return (React.createElement("div", { className: css({ width: '100%' }) },
        React.createElement(InlineFieldRow, { className: styles.row },
            React.createElement(InlineField, { label: "Label", labelWidth: 26, tooltip: "Default: duration", grow: true },
                React.createElement(Select, { inputId: "label", options: selectOptions, value: ((_a = options.jsonData.spanBar) === null || _a === void 0 ? void 0 : _a.type) || '', onChange: (v) => {
                        var _a;
                        updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'spanBar', Object.assign(Object.assign({}, options.jsonData.spanBar), { type: (_a = v === null || v === void 0 ? void 0 : v.value) !== null && _a !== void 0 ? _a : '' }));
                    }, placeholder: "Duration", isClearable: true, "aria-label": 'select-label-name', width: 40 }))),
        ((_b = options.jsonData.spanBar) === null || _b === void 0 ? void 0 : _b.type) === TAG && (React.createElement(InlineFieldRow, { className: styles.row },
            React.createElement(InlineField, { label: "Tag key", labelWidth: 26, tooltip: "Tag key which will be used to get the tag value. A span's attributes and resources will be searched for the tag key" },
                React.createElement(Input, { type: "text", placeholder: "Enter tag key", onChange: (v) => updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'spanBar', Object.assign(Object.assign({}, options.jsonData.spanBar), { tag: v.currentTarget.value })), value: ((_c = options.jsonData.spanBar) === null || _c === void 0 ? void 0 : _c.tag) || '', width: 40 }))))));
}
export const SpanBarSection = ({ options, onOptionsChange }) => {
    return (React.createElement(ConfigSubSection, { title: "Span bar", description: React.createElement(ConfigDescriptionLink, { description: "Add additional info next to the service and operation on a span bar row in the trace view.", suffix: `${options.type}/#span-bar`, feature: "the span bar" }) },
        React.createElement(SpanBarSettings, { options: options, onOptionsChange: onOptionsChange })));
};
const getStyles = (theme) => ({
    infoText: css `
    label: infoText;
    padding-bottom: ${theme.spacing(2)};
    color: ${theme.colors.text.secondary};
  `,
    row: css `
    label: row;
    align-items: baseline;
  `,
});
//# sourceMappingURL=SpanBarSettings.js.map