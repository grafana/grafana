import { BaseTransport, TransportItem } from '@grafana/faro-core';
import { getEchoSrv, EchoEventType, config } from '@grafana/runtime';

interface EchoSrcTransportOptions {
  ignoreUrls: RegExp[];
}

export class EchoSrvTransport extends BaseTransport {
  readonly name: string = 'EchoSrvTransport';
  readonly version: string = config.buildInfo.version;
  private ignoreUrls: RegExp[] = [];

  constructor(options?: EchoSrcTransportOptions) {
    super();

    this.ignoreUrls = options?.ignoreUrls ?? [];
  }

  send(items: TransportItem[]) {
    getEchoSrv().addEvent({
      type: EchoEventType.GrafanaJavascriptAgent,
      payload: items,
    });
  }

  isBatched() {
    return true;
  }

  getIgnoreUrls() {
    return this.ignoreUrls;
  }
}
