import { Event, Severity } from '@sentry/browser';
import { logger, parseRetryAfterHeader, PromiseBuffer, supportsReferrerPolicy, SyncPromise } from '@sentry/utils';
import { Response, Status } from '@sentry/types';
import { BaseTransport } from '../types';

export interface CustomEndpointTransportOptions {
  endpoint: string;
  fetchParameters?: Partial<RequestInit>;
}

/**
 * This is a copy of sentry's FetchTransport, edited to be able to push to any custom url
 * instead of using Sentry-specific endpoint logic.
 * Also transforms some of the payload values to be parseable by go.
 * Sends events sequentially and implements back-off in case of rate limiting.
 */

export class CustomEndpointTransport implements BaseTransport {
  /** Locks transport after receiving 429 response */
  private _disabledUntil: Date = new Date(Date.now());

  private readonly _buffer: PromiseBuffer<Response> = new PromiseBuffer(30);

  constructor(public options: CustomEndpointTransportOptions) {}

  sendEvent(event: Event): PromiseLike<Response> {
    if (new Date(Date.now()) < this._disabledUntil) {
      return Promise.reject({
        event,
        reason: `Transport locked till ${this._disabledUntil} due to too many requests.`,
        status: 429,
      });
    }

    const sentryReq = {
      // convert all timestamps to iso string, so it's parseable by backend
      body: JSON.stringify({
        ...event,
        level: event.level ?? (event.exception ? Severity.Error : Severity.Info),
        exception: event.exception
          ? {
              values: event.exception.values?.map((value) => ({
                ...value,
                // according to both typescript and go types, value is supposed to be string.
                // but in some odd cases at runtime it turns out to be an empty object {}
                // let's fix it here
                value: fmtSentryErrorValue(value.value),
              })),
            }
          : event.exception,
        breadcrumbs: event.breadcrumbs?.map((breadcrumb) => ({
          ...breadcrumb,
          timestamp: makeTimestamp(breadcrumb.timestamp),
        })),
        timestamp: makeTimestamp(event.timestamp),
      }),
      url: this.options.endpoint,
    };

    const options: RequestInit = {
      body: sentryReq.body,
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
      // Despite all stars in the sky saying that Edge supports old draft syntax, aka 'never', 'always', 'origin' and 'default
      // https://caniuse.com/#feat=referrer-policy
      // It doesn't. And it throw exception instead of ignoring this parameter...
      // REF: https://github.com/getsentry/raven-js/issues/1233
      referrerPolicy: (supportsReferrerPolicy() ? 'origin' : '') as ReferrerPolicy,
    };

    if (this.options.fetchParameters !== undefined) {
      Object.assign(options, this.options.fetchParameters);
    }

    return this._buffer.add(
      new SyncPromise<Response>((resolve, reject) => {
        window
          .fetch(sentryReq.url, options)
          .then((response) => {
            const status = Status.fromHttpCode(response.status);

            if (status === Status.Success) {
              resolve({ status });
              return;
            }

            if (status === Status.RateLimit) {
              const now = Date.now();
              const retryAfterHeader = response.headers.get('Retry-After');
              this._disabledUntil = new Date(now + parseRetryAfterHeader(now, retryAfterHeader));
              logger.warn(`Too many requests, backing off till: ${this._disabledUntil}`);
            }

            reject(response);
          })
          .catch(reject);
      })
    );
  }
}

function makeTimestamp(time: number | undefined): string {
  if (time) {
    return new Date(time * 1000).toISOString();
  }
  return new Date().toISOString();
}

function fmtSentryErrorValue(value: unknown): string | undefined {
  if (typeof value === 'string' || value === undefined) {
    return value;
  } else if (value && typeof value === 'object' && Object.keys(value).length === 0) {
    return '';
  }
  return String(value);
}
