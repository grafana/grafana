import { __assign, __makeTemplateObject, __read } from "tslib";
import React, { useEffect, useState } from 'react';
import { css } from '@emotion/css';
import { Button, DataLinkInput, stylesFactory, LegacyForms } from '@grafana/ui';
import { DataSourcePicker } from '@grafana/runtime';
import { usePrevious } from 'react-use';
var Switch = LegacyForms.Switch, FormField = LegacyForms.FormField;
var getStyles = stylesFactory(function () { return ({
    row: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    display: flex;\n    align-items: baseline;\n  "], ["\n    display: flex;\n    align-items: baseline;\n  "]))),
    nameField: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    flex: 2;\n  "], ["\n    flex: 2;\n  "]))),
    regexField: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    flex: 3;\n  "], ["\n    flex: 3;\n  "]))),
    urlField: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    flex: 1;\n  "], ["\n    flex: 1;\n  "]))),
    urlDisplayLabelField: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    flex: 1;\n  "], ["\n    flex: 1;\n  "]))),
}); });
export var DerivedField = function (props) {
    var value = props.value, onChange = props.onChange, onDelete = props.onDelete, suggestions = props.suggestions, className = props.className;
    var styles = getStyles();
    var _a = __read(useState(!!value.datasourceUid), 2), showInternalLink = _a[0], setShowInternalLink = _a[1];
    var previousUid = usePrevious(value.datasourceUid);
    // Force internal link visibility change if uid changed outside of this component.
    useEffect(function () {
        if (!previousUid && value.datasourceUid && !showInternalLink) {
            setShowInternalLink(true);
        }
        if (previousUid && !value.datasourceUid && showInternalLink) {
            setShowInternalLink(false);
        }
    }, [previousUid, value.datasourceUid, showInternalLink]);
    var handleChange = function (field) { return function (event) {
        var _a;
        onChange(__assign(__assign({}, value), (_a = {}, _a[field] = event.currentTarget.value, _a)));
    }; };
    return (React.createElement("div", { className: className },
        React.createElement("div", { className: styles.row },
            React.createElement(FormField, { className: styles.nameField, labelWidth: 5, 
                // A bit of a hack to prevent using default value for the width from FormField
                inputWidth: null, label: "Name", type: "text", value: value.name, onChange: handleChange('name') }),
            React.createElement(FormField, { className: styles.regexField, inputWidth: null, label: "Regex", type: "text", value: value.matcherRegex, onChange: handleChange('matcherRegex'), tooltip: 'Use to parse and capture some part of the log message. You can use the captured groups in the template.' }),
            React.createElement(Button, { variant: "destructive", title: "Remove field", icon: "times", onClick: function (event) {
                    event.preventDefault();
                    onDelete();
                }, className: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n            margin-left: 8px;\n          "], ["\n            margin-left: 8px;\n          "]))) })),
        React.createElement("div", { className: styles.row },
            React.createElement(FormField, { label: showInternalLink ? 'Query' : 'URL', inputEl: React.createElement(DataLinkInput, { placeholder: showInternalLink ? '${__value.raw}' : 'http://example.com/${__value.raw}', value: value.url || '', onChange: function (newValue) {
                        return onChange(__assign(__assign({}, value), { url: newValue }));
                    }, suggestions: suggestions }), className: styles.urlField }),
            React.createElement(FormField, { className: styles.urlDisplayLabelField, inputWidth: null, label: "URL Label", type: "text", value: value.urlDisplayLabel, onChange: handleChange('urlDisplayLabel'), tooltip: 'Use to override the button label when this derived field is found in a log.' })),
        React.createElement("div", { className: styles.row },
            React.createElement(Switch, { label: "Internal link", checked: showInternalLink, onChange: function () {
                    if (showInternalLink) {
                        onChange(__assign(__assign({}, value), { datasourceUid: undefined }));
                    }
                    setShowInternalLink(!showInternalLink);
                } }),
            showInternalLink && (React.createElement(DataSourcePicker, { tracing: true, onChange: function (ds) {
                    return onChange(__assign(__assign({}, value), { datasourceUid: ds.uid }));
                }, current: value.datasourceUid })))));
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6;
//# sourceMappingURL=DerivedField.js.map