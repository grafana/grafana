import { __makeTemplateObject, __read, __spreadArray } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { Button, useStyles2 } from '@grafana/ui';
import { VariableOrigin, DataLinkBuiltInVars } from '@grafana/data';
import { DataLink } from './DataLink';
var getStyles = function (theme) {
    return {
        infoText: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      padding-bottom: ", ";\n      color: ", ";\n    "], ["\n      padding-bottom: ", ";\n      color: ", ";\n    "])), theme.spacing(2), theme.colors.text.secondary),
        dataLink: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      margin-bottom: ", ";\n    "], ["\n      margin-bottom: ", ";\n    "])), theme.spacing(1)),
    };
};
export var DataLinks = function (props) {
    var value = props.value, onChange = props.onChange;
    var styles = useStyles2(getStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement("h3", { className: "page-heading" }, "Data links"),
        React.createElement("div", { className: styles.infoText }, "Add links to existing fields. Links will be shown in log row details next to the field value."),
        value && value.length > 0 && (React.createElement("div", { className: "gf-form-group" }, value.map(function (field, index) {
            return (React.createElement(DataLink, { className: styles.dataLink, key: index, value: field, onChange: function (newField) {
                    var newDataLinks = __spreadArray([], __read(value), false);
                    newDataLinks.splice(index, 1, newField);
                    onChange(newDataLinks);
                }, onDelete: function () {
                    var newDataLinks = __spreadArray([], __read(value), false);
                    newDataLinks.splice(index, 1);
                    onChange(newDataLinks);
                }, suggestions: [
                    {
                        value: DataLinkBuiltInVars.valueRaw,
                        label: 'Raw value',
                        documentation: 'Raw value of the field',
                        origin: VariableOrigin.Value,
                    },
                ] }));
        }))),
        React.createElement(Button, { variant: 'secondary', className: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n          margin-right: 10px;\n        "], ["\n          margin-right: 10px;\n        "]))), icon: "plus", onClick: function (event) {
                event.preventDefault();
                var newDataLinks = __spreadArray(__spreadArray([], __read((value || [])), false), [{ field: '', url: '' }], false);
                onChange(newDataLinks);
            } }, "Add")));
};
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=DataLinks.js.map