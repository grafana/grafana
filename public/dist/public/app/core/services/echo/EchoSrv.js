import { faro } from '@grafana/faro-web-sdk';
import { getEchoSrv, EchoEventType } from '@grafana/runtime';
export const reportPerformance = (metric, value) => {
    getEchoSrv().addEvent({
        type: EchoEventType.Performance,
        payload: {
            name: metric,
            value: value,
        },
    });
};
// Farp will process the error, then push it to EchoSrv as GrafanaJavascriptAgent event
export const reportError = (error) => { var _a; return (_a = faro === null || faro === void 0 ? void 0 : faro.api) === null || _a === void 0 ? void 0 : _a.pushError(error); };
//# sourceMappingURL=EchoSrv.js.map