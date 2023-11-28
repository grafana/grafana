import { BaseTransport } from '@grafana/faro-core';
import { getEchoSrv, EchoEventType, config } from '@grafana/runtime';
export class EchoSrvTransport extends BaseTransport {
    constructor() {
        super(...arguments);
        this.name = 'EchoSrvTransport';
        this.version = config.buildInfo.version;
    }
    send(items) {
        getEchoSrv().addEvent({
            type: EchoEventType.GrafanaJavascriptAgent,
            payload: items,
        });
    }
    isBatched() {
        return true;
    }
    getIgnoreUrls() {
        return [];
    }
}
//# sourceMappingURL=EchoSrvTransport.js.map