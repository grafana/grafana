import { Severity } from 'app/percona/shared/core';
export const failureToSeverity = (count) => {
    switch (count) {
        case 'emergency':
            return Severity.SEVERITY_EMERGENCY;
        case 'alert':
            return Severity.SEVERITY_ALERT;
        case 'critical':
            return Severity.SEVERITY_CRITICAL;
        case 'error':
            return Severity.SEVERITY_ERROR;
        case 'warning':
            return Severity.SEVERITY_WARNING;
        case 'notice':
            return Severity.SEVERITY_NOTICE;
        case 'info':
            return Severity.SEVERITY_INFO;
        case 'debug':
            return Severity.SEVERITY_DEBUG;
        default:
            return Severity.SEVERITY_DEBUG;
    }
};
//# sourceMappingURL=Failures.utils.js.map