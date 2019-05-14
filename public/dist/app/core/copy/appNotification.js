import * as tslib_1 from "tslib";
import { AppNotificationSeverity, AppNotificationTimeout } from 'app/types';
import { getMessageFromError } from 'app/core/utils/errors';
var defaultSuccessNotification = {
    title: '',
    text: '',
    severity: AppNotificationSeverity.Success,
    icon: 'fa fa-check',
    timeout: AppNotificationTimeout.Success,
};
var defaultWarningNotification = {
    title: '',
    text: '',
    severity: AppNotificationSeverity.Warning,
    icon: 'fa fa-exclamation',
    timeout: AppNotificationTimeout.Warning,
};
var defaultErrorNotification = {
    title: '',
    text: '',
    severity: AppNotificationSeverity.Error,
    icon: 'fa fa-exclamation-triangle',
    timeout: AppNotificationTimeout.Error,
};
export var createSuccessNotification = function (title, text) { return (tslib_1.__assign({}, defaultSuccessNotification, { title: title, text: text, id: Date.now() })); };
export var createErrorNotification = function (title, text) {
    return tslib_1.__assign({}, defaultErrorNotification, { title: title, text: getMessageFromError(text), id: Date.now() });
};
export var createWarningNotification = function (title, text) { return (tslib_1.__assign({}, defaultWarningNotification, { title: title, text: text, id: Date.now() })); };
//# sourceMappingURL=appNotification.js.map