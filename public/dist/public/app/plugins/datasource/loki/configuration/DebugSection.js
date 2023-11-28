import React, { useState } from 'react';
import { FieldType } from '@grafana/data';
import { InlineField, TextArea } from '@grafana/ui';
import { getFieldLinksForExplore } from '../../../../features/explore/utils/links';
export const DebugSection = (props) => {
    const { derivedFields, className } = props;
    const [debugText, setDebugText] = useState('');
    let debugFields = [];
    if (debugText && derivedFields) {
        debugFields = makeDebugFields(derivedFields, debugText);
    }
    return (React.createElement("div", { className: className },
        React.createElement(InlineField, { label: "Debug log message", labelWidth: 24, grow: true },
            React.createElement(TextArea, { type: "text", "aria-label": "Prometheus Query", placeholder: "Paste an example log line here to test the regular expressions of your derived fields", value: debugText, onChange: (event) => setDebugText(event.currentTarget.value) })),
        !!debugFields.length && React.createElement(DebugFields, { fields: debugFields })));
};
const DebugFields = ({ fields }) => {
    return (React.createElement("table", { className: 'filter-table' },
        React.createElement("thead", null,
            React.createElement("tr", null,
                React.createElement("th", null, "Name"),
                React.createElement("th", null, "Value"),
                React.createElement("th", null, "Url"))),
        React.createElement("tbody", null, fields.map((field) => {
            let value = field.value;
            if (field.error && field.error instanceof Error) {
                value = field.error.message;
            }
            else if (field.href) {
                value = React.createElement("a", { href: field.href }, value);
            }
            return (React.createElement("tr", { key: `${field.name}=${field.value}` },
                React.createElement("td", null, field.name),
                React.createElement("td", null, value),
                React.createElement("td", null, field.href ? React.createElement("a", { href: field.href }, field.href) : '')));
        }))));
};
function makeDebugFields(derivedFields, debugText) {
    return derivedFields
        .filter((field) => field.name && field.matcherRegex)
        .map((field) => {
        try {
            const testMatch = debugText.match(field.matcherRegex);
            const value = testMatch && testMatch[1];
            let link = null;
            if (field.url && value) {
                link = getFieldLinksForExplore({
                    field: {
                        name: '',
                        type: FieldType.string,
                        values: [value],
                        config: {
                            links: [{ title: '', url: field.url }],
                        },
                    },
                    rowIndex: 0,
                    range: {},
                })[0];
            }
            const result = {
                name: field.name,
                value: value || '<no match>',
                href: link ? link.href : undefined,
            };
            return result;
        }
        catch (error) {
            const result = {
                name: field.name,
                error,
            };
            return result;
        }
    });
}
//# sourceMappingURL=DebugSection.js.map