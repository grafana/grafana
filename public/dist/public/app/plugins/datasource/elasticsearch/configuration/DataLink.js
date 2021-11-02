import { __assign, __makeTemplateObject, __read } from "tslib";
import React, { useEffect, useState } from 'react';
import { css } from '@emotion/css';
import { DataSourcePicker } from '@grafana/runtime';
import { Button, LegacyForms, DataLinkInput, stylesFactory } from '@grafana/ui';
var FormField = LegacyForms.FormField, Switch = LegacyForms.Switch;
import { usePrevious } from 'react-use';
var getStyles = stylesFactory(function () { return ({
    firstRow: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    display: flex;\n  "], ["\n    display: flex;\n  "]))),
    nameField: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    flex: 2;\n  "], ["\n    flex: 2;\n  "]))),
    regexField: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    flex: 3;\n  "], ["\n    flex: 3;\n  "]))),
    row: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    display: flex;\n    align-items: baseline;\n  "], ["\n    display: flex;\n    align-items: baseline;\n  "]))),
    urlField: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    flex: 1;\n  "], ["\n    flex: 1;\n  "]))),
    urlDisplayLabelField: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    flex: 1;\n  "], ["\n    flex: 1;\n  "]))),
}); });
export var DataLink = function (props) {
    var value = props.value, onChange = props.onChange, onDelete = props.onDelete, suggestions = props.suggestions, className = props.className;
    var styles = getStyles();
    var _a = __read(useInternalLink(value.datasourceUid), 2), showInternalLink = _a[0], setShowInternalLink = _a[1];
    var handleChange = function (field) { return function (event) {
        var _a;
        onChange(__assign(__assign({}, value), (_a = {}, _a[field] = event.currentTarget.value, _a)));
    }; };
    return (React.createElement("div", { className: className },
        React.createElement("div", { className: styles.firstRow + ' gf-form' },
            React.createElement(FormField, { className: styles.nameField, labelWidth: 6, 
                // A bit of a hack to prevent using default value for the width from FormField
                inputWidth: null, label: "Field", type: "text", value: value.field, tooltip: 'Can be exact field name or a regex pattern that will match on the field name.', onChange: handleChange('field') }),
            React.createElement(Button, { variant: 'destructive', title: "Remove field", icon: "times", onClick: function (event) {
                    event.preventDefault();
                    onDelete();
                } })),
        React.createElement("div", { className: "gf-form" },
            React.createElement(FormField, { label: showInternalLink ? 'Query' : 'URL', labelWidth: 6, inputEl: React.createElement(DataLinkInput, { placeholder: showInternalLink ? '${__value.raw}' : 'http://example.com/${__value.raw}', value: value.url || '', onChange: function (newValue) {
                        return onChange(__assign(__assign({}, value), { url: newValue }));
                    }, suggestions: suggestions }), className: styles.urlField }),
            React.createElement(FormField, { className: styles.urlDisplayLabelField, inputWidth: null, label: "URL Label", type: "text", value: value.urlDisplayLabel, onChange: handleChange('urlDisplayLabel'), tooltip: 'Use to override the button label.' })),
        React.createElement("div", { className: styles.row },
            React.createElement(Switch, { labelClass: 'width-6', label: "Internal link", checked: showInternalLink, onChange: function () {
                    if (showInternalLink) {
                        onChange(__assign(__assign({}, value), { datasourceUid: undefined }));
                    }
                    setShowInternalLink(!showInternalLink);
                } }),
            showInternalLink && (React.createElement(DataSourcePicker, { tracing: true, 
                // Uid and value should be always set in the db and so in the items.
                onChange: function (ds) {
                    onChange(__assign(__assign({}, value), { datasourceUid: ds.uid }));
                }, current: value.datasourceUid })))));
};
function useInternalLink(datasourceUid) {
    var _a = __read(useState(!!datasourceUid), 2), showInternalLink = _a[0], setShowInternalLink = _a[1];
    var previousUid = usePrevious(datasourceUid);
    // Force internal link visibility change if uid changed outside of this component.
    useEffect(function () {
        if (!previousUid && datasourceUid && !showInternalLink) {
            setShowInternalLink(true);
        }
        if (previousUid && !datasourceUid && showInternalLink) {
            setShowInternalLink(false);
        }
    }, [previousUid, datasourceUid, showInternalLink]);
    return [showInternalLink, setShowInternalLink];
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6;
//# sourceMappingURL=DataLink.js.map