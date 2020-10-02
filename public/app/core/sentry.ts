import { Transports, Event, init as origSentryInit, BrowserOptions } from '@sentry/react';
import { logger, parseRetryAfterHeader, supportsReferrerPolicy, SyncPromise } from '@sentry/utils';
import { Response, Status } from '@sentry/types';
import config from 'app/core/config';

/**
 * This is a copy of sentry's FetchTransport, edited to be able to push to any custom url
 * instead of using Sentry-specific endpoint logic
 */
export class CustomFetchTransport extends Transports.BaseTransport {
  /** Locks transport after receiving 429 response */
  private _disabledUntil: Date = new Date(Date.now());

  sendEvent(event: Event): PromiseLike<Response> {
    if (new Date(Date.now()) < this._disabledUntil) {
      return Promise.reject({
        event,
        reason: `Transport locked till ${this._disabledUntil} due to too many requests.`,
        status: 429,
      });
    }

    const sentryReq = {
      body: JSON.stringify(event),
      url: this.options.fetchParameters!.endpoint,
    };

    const options: RequestInit = {
      body: sentryReq.body,
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

    if (this.options.headers !== undefined) {
      options.headers = this.options.headers;
    }

    return this._buffer.add(
      new SyncPromise<Response>((resolve, reject) => {
        window
          .fetch(sentryReq.url, options)
          .then(response => {
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

export function initSentry() {
  console.log('sentry', config.sentry);
  if (config.sentry.enabled) {
    const { dsn, customEndpoint } = config.sentry;

    const sentryOptions: BrowserOptions = {};

    if (dsn) {
      sentryOptions.dsn = dsn;
    } else if (customEndpoint) {
      // does not send events without a valid dsn defined :-(
      // but it won't actually be used, CustomFetchTransport will send to settings.customEndpoint
      sentryOptions.dsn = 'https://examplePublicKey@o0.ingest.sentry.io/0';
      sentryOptions.transport = CustomFetchTransport;
      sentryOptions.transportOptions = {
        dsn: '',
        fetchParameters: {
          endpoint: customEndpoint,
        },
      };
    }
    origSentryInit(sentryOptions);
    console.log('sentry initialized');
  }
}
