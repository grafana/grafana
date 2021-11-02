import { __makeTemplateObject, __read, __spreadArray } from "tslib";
import { css } from '@emotion/css';
import { selectors } from '@grafana/e2e-selectors';
import { Button } from '@grafana/ui';
import React from 'react';
import ExemplarSetting from './ExemplarSetting';
export function ExemplarsSettings(_a) {
    var options = _a.options, onChange = _a.onChange;
    return (React.createElement(React.Fragment, null,
        React.createElement("h3", { className: "page-heading" }, "Exemplars"),
        options &&
            options.map(function (option, index) {
                return (React.createElement(ExemplarSetting, { key: index, value: option, onChange: function (newField) {
                        var newOptions = __spreadArray([], __read(options), false);
                        newOptions.splice(index, 1, newField);
                        onChange(newOptions);
                    }, onDelete: function () {
                        var newOptions = __spreadArray([], __read(options), false);
                        newOptions.splice(index, 1);
                        onChange(newOptions);
                    } }));
            }),
        React.createElement(Button, { variant: "secondary", "aria-label": selectors.components.DataSource.Prometheus.configPage.exemplarsAddButton, className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n          margin-bottom: 10px;\n        "], ["\n          margin-bottom: 10px;\n        "]))), icon: "plus", onClick: function (event) {
                event.preventDefault();
                var newOptions = __spreadArray(__spreadArray([], __read((options || [])), false), [{ name: 'traceID' }], false);
                onChange(newOptions);
            } }, "Add")));
}
var templateObject_1;
//# sourceMappingURL=ExemplarsSettings.js.map