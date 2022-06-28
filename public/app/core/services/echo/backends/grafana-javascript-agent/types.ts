import { CurrentUserDTO } from '@grafana/data';
import { EchoEvent, EchoEventType } from '@grafana/runtime';

export interface BaseTransport {
  sendEvent(event: EchoEvent): PromiseLike<Response>;
}

export type GrafanaJavascriptAgentEchoEvent = EchoEvent<EchoEventType.GrafanaJavascriptAgent>;

export interface User extends Pick<CurrentUserDTO, 'email'> {
  id: string;
  orgId?: number;
}
