import { __makeTemplateObject, __read } from "tslib";
import React, { useState } from 'react';
import { css } from '@emotion/css';
import cx from 'classnames';
import { LegacyForms } from '@grafana/ui';
var FormField = LegacyForms.FormField;
import { ArrayVector, FieldType } from '@grafana/data';
import { getFieldLinksForExplore } from '../../../../features/explore/utils/links';
export var DebugSection = function (props) {
    var derivedFields = props.derivedFields, className = props.className;
    var _a = __read(useState(''), 2), debugText = _a[0], setDebugText = _a[1];
    var debugFields = [];
    if (debugText && derivedFields) {
        debugFields = makeDebugFields(derivedFields, debugText);
    }
    return (React.createElement("div", { className: className },
        React.createElement(FormField, { labelWidth: 12, label: 'Debug log message', inputEl: React.createElement("textarea", { placeholder: 'Paste an example log line here to test the regular expressions of your derived fields', className: cx('gf-form-input gf-form-textarea', css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n                width: 100%;\n              "], ["\n                width: 100%;\n              "])))), value: debugText, onChange: function (event) { return setDebugText(event.currentTarget.value); } }) }),
        !!debugFields.length && React.createElement(DebugFields, { fields: debugFields })));
};
var DebugFields = function (_a) {
    var fields = _a.fields;
    return (React.createElement("table", { className: 'filter-table' },
        React.createElement("thead", null,
            React.createElement("tr", null,
                React.createElement("th", null, "Name"),
                React.createElement("th", null, "Value"),
                React.createElement("th", null, "Url"))),
        React.createElement("tbody", null, fields.map(function (field) {
            var value = field.value;
            if (field.error) {
                value = field.error.message;
            }
            else if (field.href) {
                value = React.createElement("a", { href: field.href }, value);
            }
            return (React.createElement("tr", { key: field.name + "=" + field.value },
                React.createElement("td", null, field.name),
                React.createElement("td", null, value),
                React.createElement("td", null, field.href ? React.createElement("a", { href: field.href }, field.href) : '')));
        }))));
};
function makeDebugFields(derivedFields, debugText) {
    return derivedFields
        .filter(function (field) { return field.name && field.matcherRegex; })
        .map(function (field) {
        try {
            var testMatch = debugText.match(field.matcherRegex);
            var value = testMatch && testMatch[1];
            var link = null;
            if (field.url && value) {
                link = getFieldLinksForExplore({
                    field: {
                        name: '',
                        type: FieldType.string,
                        values: new ArrayVector([value]),
                        config: {
                            links: [{ title: '', url: field.url }],
                        },
                    },
                    rowIndex: 0,
                    range: {},
                })[0];
            }
            return {
                name: field.name,
                value: value || '<no match>',
                href: link && link.href,
            };
        }
        catch (error) {
            return {
                name: field.name,
                error: error,
            };
        }
    });
}
var templateObject_1;
//# sourceMappingURL=DebugSection.js.map