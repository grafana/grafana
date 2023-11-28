import { useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getMessageFromError } from 'app/core/utils/errors';
import { AppNotificationSeverity, useDispatch } from 'app/types';
import { notifyApp } from '../actions';
const defaultSuccessNotification = {
    title: '',
    text: '',
    severity: AppNotificationSeverity.Success,
    icon: 'check',
};
const defaultWarningNotification = {
    title: '',
    text: '',
    severity: AppNotificationSeverity.Warning,
    icon: 'exclamation-triangle',
};
const defaultErrorNotification = {
    title: '',
    text: '',
    severity: AppNotificationSeverity.Error,
    icon: 'exclamation-triangle',
};
export const createSuccessNotification = (title, text = '', traceId) => (Object.assign(Object.assign({}, defaultSuccessNotification), { title,
    text, id: uuidv4(), timestamp: Date.now(), showing: true }));
export const createErrorNotification = (title, text = '', traceId, component) => {
    return Object.assign(Object.assign({}, defaultErrorNotification), { text: getMessageFromError(text), title, id: uuidv4(), traceId,
        component, timestamp: Date.now(), showing: true });
};
export const createWarningNotification = (title, text = '', traceId) => (Object.assign(Object.assign({}, defaultWarningNotification), { title,
    text,
    traceId, id: uuidv4(), timestamp: Date.now(), showing: true }));
/** Hook for showing toast notifications with varying severity (success, warning error).
 * @example
 * const notifyApp = useAppNotification();
 * notifyApp.success('Success!', 'Some additional text');
 * notifyApp.warning('Warning!');
 * notifyApp.error('Error!');
 */
export function useAppNotification() {
    const dispatch = useDispatch();
    return useMemo(() => ({
        success: (title, text = '') => {
            dispatch(notifyApp(createSuccessNotification(title, text)));
        },
        warning: (title, text = '', traceId) => {
            dispatch(notifyApp(createWarningNotification(title, text, traceId)));
        },
        error: (title, text = '', traceId) => {
            dispatch(notifyApp(createErrorNotification(title, text, traceId)));
        },
    }), [dispatch]);
}
//# sourceMappingURL=appNotification.js.map