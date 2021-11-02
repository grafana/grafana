import { __makeTemplateObject, __read } from "tslib";
import React, { useEffect, useState } from 'react';
import { getDashboardQueryRunner } from '../../../query/state/DashboardQueryRunner/DashboardQueryRunner';
import { AnnotationQueryFinished, AnnotationQueryStarted } from '../../../../types/events';
import { InlineField, InlineSwitch, useStyles2 } from '@grafana/ui';
import { LoadingIndicator } from '@grafana/ui/src/components/PanelChrome/LoadingIndicator';
import { css } from '@emotion/css';
export var AnnotationPicker = function (_a) {
    var annotation = _a.annotation, events = _a.events, onEnabledChanged = _a.onEnabledChanged;
    var _b = __read(useState(false), 2), loading = _b[0], setLoading = _b[1];
    var styles = useStyles2(getStyles);
    var onCancel = function () { return getDashboardQueryRunner().cancel(annotation); };
    useEffect(function () {
        var started = events.getStream(AnnotationQueryStarted).subscribe({
            next: function (event) {
                if (event.payload === annotation) {
                    setLoading(true);
                }
            },
        });
        var stopped = events.getStream(AnnotationQueryFinished).subscribe({
            next: function (event) {
                if (event.payload === annotation) {
                    setLoading(false);
                }
            },
        });
        return function () {
            started.unsubscribe();
            stopped.unsubscribe();
        };
    });
    return (React.createElement("div", { key: annotation.name, className: styles.annotation },
        React.createElement(InlineField, { label: annotation.name, disabled: loading },
            React.createElement(React.Fragment, null,
                React.createElement(InlineSwitch, { value: annotation.enable, onChange: function () { return onEnabledChanged(annotation); }, disabled: loading }),
                React.createElement("div", { className: styles.indicator },
                    React.createElement(LoadingIndicator, { loading: loading, onCancel: onCancel }))))));
};
function getStyles(theme) {
    return {
        annotation: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: inline-block;\n      margin-right: ", ";\n\n      .fa-caret-down {\n        font-size: 75%;\n        padding-left: ", ";\n      }\n\n      .gf-form-inline .gf-form {\n        margin-bottom: 0;\n      }\n    "], ["\n      display: inline-block;\n      margin-right: ", ";\n\n      .fa-caret-down {\n        font-size: 75%;\n        padding-left: ", ";\n      }\n\n      .gf-form-inline .gf-form {\n        margin-bottom: 0;\n      }\n    "])), theme.spacing(1), theme.spacing(1)),
        indicator: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      align-self: center;\n      padding: 0 ", ";\n    "], ["\n      align-self: center;\n      padding: 0 ", ";\n    "])), theme.spacing(0.5)),
    };
}
var templateObject_1, templateObject_2;
//# sourceMappingURL=AnnotationPicker.js.map