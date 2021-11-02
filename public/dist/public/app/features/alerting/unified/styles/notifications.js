import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
import { AlertState } from 'app/plugins/datasource/alertmanager/types';
export var getNotificationsTextColors = function (theme) {
    var _a;
    return (_a = {},
        _a[AlertState.Active] = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.colors.error.text),
        _a[AlertState.Suppressed] = css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.colors.primary.text),
        _a[AlertState.Unprocessed] = css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.colors.secondary.text),
        _a);
};
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=notifications.js.map