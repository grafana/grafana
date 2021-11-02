import { getEchoSrv, EchoEventType } from '@grafana/runtime';
import { captureException } from '@sentry/browser';
export var reportPerformance = function (metric, value) {
    getEchoSrv().addEvent({
        type: EchoEventType.Performance,
        payload: {
            name: metric,
            value: value,
        },
    });
};
// Sentry will process the error, adding it's own metadata, applying any sampling rules,
// then push it to EchoSrv as SentryEvent
export var reportError = function (error) { return captureException(error); };
//# sourceMappingURL=EchoSrv.js.map