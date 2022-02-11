import { getEchoSrv, EchoEventType } from '@grafana/runtime';
import { BaseTransport } from '@sentry/browser/dist/transports';
import { Event } from '@sentry/browser';
import { EventStatus, Request, Session, Response } from '@sentry/types';

export class EchoSrvTransport extends BaseTransport {
  sendEvent(event: Event) {
    getEchoSrv().addEvent({
      type: EchoEventType.Sentry,
      payload: event,
    });
    return Promise.resolve({ status: 'success' as EventStatus, event });
  }
  // not recording sessions for now
  sendSession(session: Session): PromiseLike<Response> {
    return Promise.resolve({ status: 'skipped' });
  }
  // required by BaseTransport definition but not used by this implementation
  _sendRequest(sentryRequest: Request, originalPayload: Event | Session): PromiseLike<Response> {
    throw new Error('should not happen');
  }
}
