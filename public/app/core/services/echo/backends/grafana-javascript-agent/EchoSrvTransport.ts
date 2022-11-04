import { BaseTransport, TransportItem } from '@grafana/faro-core';
import { getEchoSrv, EchoEventType, config } from '@grafana/runtime';
export class EchoSrvTransport extends BaseTransport {
  readonly name: string = 'EchoSrvTransport';
  readonly version: string = config.buildInfo.version;
  send(event: TransportItem) {
    getEchoSrv().addEvent({
      type: EchoEventType.GrafanaJavascriptAgent,
      payload: event,
    });
  }
  getIgnoreUrls() {
    return [];
  }
}
