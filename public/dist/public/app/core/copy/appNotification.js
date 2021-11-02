import { __assign } from "tslib";
import { AppNotificationSeverity, AppNotificationTimeout } from 'app/types';
import { getMessageFromError } from 'app/core/utils/errors';
import { v4 as uuidv4 } from 'uuid';
var defaultSuccessNotification = {
    title: '',
    text: '',
    severity: AppNotificationSeverity.Success,
    icon: 'check',
    timeout: AppNotificationTimeout.Success,
};
var defaultWarningNotification = {
    title: '',
    text: '',
    severity: AppNotificationSeverity.Warning,
    icon: 'exclamation-triangle',
    timeout: AppNotificationTimeout.Warning,
};
var defaultErrorNotification = {
    title: '',
    text: '',
    severity: AppNotificationSeverity.Error,
    icon: 'exclamation-triangle',
    timeout: AppNotificationTimeout.Error,
};
export var createSuccessNotification = function (title, text) {
    if (text === void 0) { text = ''; }
    return (__assign(__assign({}, defaultSuccessNotification), { title: title, text: text, id: uuidv4() }));
};
export var createErrorNotification = function (title, text, component) {
    if (text === void 0) { text = ''; }
    return __assign(__assign({}, defaultErrorNotification), { text: getMessageFromError(text), title: title, id: uuidv4(), component: component });
};
export var createWarningNotification = function (title, text) {
    if (text === void 0) { text = ''; }
    return (__assign(__assign({}, defaultWarningNotification), { title: title, text: text, id: uuidv4() }));
};
//# sourceMappingURL=appNotification.js.map