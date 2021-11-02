import { __makeTemplateObject } from "tslib";
import React, { useCallback } from 'react';
import { useStyles } from '@grafana/ui';
import { css } from '@emotion/css';
import { AlertLabel } from '../AlertLabel';
import { matcherToOperator } from '../../utils/alertmanager';
export var Matchers = function (_a) {
    var matchers = _a.matchers, onRemoveLabel = _a.onRemoveLabel;
    var styles = useStyles(getStyles);
    var removeLabel = useCallback(function (index) {
        if (!!onRemoveLabel) {
            onRemoveLabel(index);
        }
    }, [onRemoveLabel]);
    return (React.createElement("div", { className: styles.wrapper }, matchers.map(function (matcher, index) {
        var name = matcher.name, value = matcher.value;
        return (React.createElement(AlertLabel, { key: name + "-" + value + "-" + index, labelKey: name, value: value, operator: matcherToOperator(matcher), onRemoveLabel: !!onRemoveLabel ? function () { return removeLabel(index); } : undefined }));
    })));
};
var getStyles = function (theme) { return ({
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    & > * {\n      margin-top: ", ";\n      margin-right: ", ";\n    }\n    padding-bottom: ", ";\n  "], ["\n    & > * {\n      margin-top: ", ";\n      margin-right: ", ";\n    }\n    padding-bottom: ", ";\n  "])), theme.spacing.xs, theme.spacing.xs, theme.spacing.xs),
}); };
var templateObject_1;
//# sourceMappingURL=Matchers.js.map