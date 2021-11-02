import { __extends } from "tslib";
import { getEchoSrv, EchoEventType } from '@grafana/runtime';
import { BaseTransport } from '@sentry/browser/dist/transports';
import { Status } from '@sentry/types';
var EchoSrvTransport = /** @class */ (function (_super) {
    __extends(EchoSrvTransport, _super);
    function EchoSrvTransport() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    EchoSrvTransport.prototype.sendEvent = function (event) {
        getEchoSrv().addEvent({
            type: EchoEventType.Sentry,
            payload: event,
        });
        return Promise.resolve({ status: Status.Success, event: event });
    };
    return EchoSrvTransport;
}(BaseTransport));
export { EchoSrvTransport };
//# sourceMappingURL=EchoSrvTransport.js.map