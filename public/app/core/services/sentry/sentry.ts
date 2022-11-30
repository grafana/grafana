import { BrowserOptions, init, setUser as sentrySetUser } from '@sentry/browser';

import { SentryConfig, BuildInfo } from '@grafana/data/src/types/config';

import { User } from './types';

export interface SentryOptions extends SentryConfig {
  user?: User;
  buildInfo: BuildInfo;
}

export function initSentry(options: SentryOptions) {
  // set up transports to post events to grafana backend and/or Sentry

  // initialize Sentry so it can set up its hooks and start collecting errors
  const sentryOptions: BrowserOptions = {
    release: options.buildInfo.version,
    environment: options.buildInfo.env,
    dsn: options.dsn,
    sampleRate: options.sampleRate,
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed',
      'Non-Error exception captured with keys',
    ],
  };

  if (options.user) {
    sentrySetUser({
      email: options.user.email,
      id: String(options.user.id),
    });
  }

  init(sentryOptions);
}
