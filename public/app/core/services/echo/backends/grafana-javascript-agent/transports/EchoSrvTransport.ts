import { getEchoSrv, EchoEventType } from '@grafana/runtime';

export class EchoSrvTransport {
  sendEvent(event: Event) {
    getEchoSrv().addEvent({
      type: EchoEventType.GrafanaJavascriptAgent,
      payload: event,
    });
    return Promise.resolve({ status: 'success', event });
  }
}
