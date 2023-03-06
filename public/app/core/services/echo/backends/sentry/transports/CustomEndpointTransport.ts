import { Event, Severity } from '@sentry/browser';
import { Response } from '@sentry/types';
import {
  logger,
  makePromiseBuffer,
  parseRetryAfterHeader,
  PromiseBuffer,
  supportsReferrerPolicy,
  SyncPromise,
} from '@sentry/utils';

import { BaseTransport } from '../types';

export interface CustomEndpointTransportOptions {
  endpoint: string;
  fetchParameters?: Partial<RequestInit>;
  maxConcurrentRequests?: number;
}

const DEFAULT_MAX_CONCURRENT_REQUESTS = 3;

const DEFAULT_RATE_LIMIT_TIMEOUT_MS = 5000;

/**
 * This is a copy of sentry's FetchTransport, edited to be able to push to any custom url
 * instead of using Sentry-specific endpoint logic.
 * Also transforms some of the payload values to be parseable by go.
 * Sends events sequentially and implements back-off in case of rate limiting.
 */

export class CustomEndpointTransport implements BaseTransport {
  /** Locks transport after receiving 429 response */
  private _disabledUntil: Date = new Date(Date.now());

  private readonly _buffer: PromiseBuffer<Response>;

  constructor(public options: CustomEndpointTransportOptions) {
    this._buffer = makePromiseBuffer(options.maxConcurrentRequests ?? DEFAULT_MAX_CONCURRENT_REQUESTS);
  }

  sendEvent(event: Event): PromiseLike<Response> {
    if (new Date(Date.now()) < this._disabledUntil) {
      const reason = `Dropping frontend event due to too many requests.`;
      console.warn(reason);
      return Promise.resolve({
        event,
        reason,
        status: 'skipped',
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
      referrerPolicy: supportsReferrerPolicy() ? 'origin' : '',
    };

    if (this.options.fetchParameters !== undefined) {
      Object.assign(options, this.options.fetchParameters);
    }

    return this._buffer
      .add(
        () =>
          new SyncPromise<Response>((resolve, reject) => {
            window
              .fetch(sentryReq.url, options)
              .then((response) => {
                if (response.status === 200) {
                  resolve({ status: 'success' });
                  return;
                }

                if (response.status === 429) {
                  const now = Date.now();
                  const retryAfterHeader = response.headers.get('Retry-After');
                  if (retryAfterHeader) {
                    this._disabledUntil = new Date(now + parseRetryAfterHeader(retryAfterHeader, now));
                  } else {
                    this._disabledUntil = new Date(now + DEFAULT_RATE_LIMIT_TIMEOUT_MS);
                  }
                  logger.warn(`Too many requests, backing off till: ${this._disabledUntil}`);
                }

                reject(response);
              })
              .catch(reject);
          })
      )
      .then(undefined, (reason) => {
        if (reason.message === 'Not adding Promise due to buffer limit reached.') {
          const msg = `Dropping frontend log event due to too many requests in flight.`;
          console.warn(msg);
          return {
            event,
            reason: msg,
            status: 'skipped',
          };
        }
        throw reason;
      });
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
