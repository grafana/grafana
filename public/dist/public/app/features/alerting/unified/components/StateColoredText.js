import { __makeTemplateObject } from "tslib";
import { useStyles2 } from '@grafana/ui';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import { css } from '@emotion/css';
import React from 'react';
export var StateColoredText = function (_a) {
    var children = _a.children, status = _a.status;
    var styles = useStyles2(getStyles);
    return React.createElement("span", { className: styles[status] }, children || status);
};
var getStyles = function (theme) {
    var _a;
    return (_a = {},
        _a[PromAlertingRuleState.Inactive] = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.colors.success.text),
        _a[PromAlertingRuleState.Pending] = css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.colors.warning.text),
        _a[PromAlertingRuleState.Firing] = css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.colors.error.text),
        _a.neutral = css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.colors.text.secondary),
        _a);
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=StateColoredText.js.map