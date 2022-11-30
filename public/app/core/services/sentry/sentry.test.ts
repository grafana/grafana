import { init, setUser as sentrySetUser } from '@sentry/browser';

import { BuildInfo } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/src/types/config';

import { initSentry, SentryOptions } from './sentry';

jest.mock('@sentry/browser');

describe('SentryEchoBackend', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    window.fetch = jest.fn();
  });

  const buildInfo: BuildInfo = {
    version: '1.0',
    commit: 'abcd123',
    env: 'production',
    edition: GrafanaEdition.OpenSource,
    latestVersion: 'ba',
    hasUpdate: false,
    hideVersion: false,
  };

  const options: SentryOptions = {
    enabled: true,
    buildInfo,
    dsn: 'https://examplePublicKey@o0.ingest.testsentry.io/0',
    sampleRate: 1,
    customEndpoint: '',
    user: {
      email: 'darth.vader@sith.glx',
      id: 504,
      orgId: 1,
    },
  };

  it('will initialize sentry and set user', async () => {
    initSentry(options);
    expect(init).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledWith({
      release: buildInfo.version,
      environment: buildInfo.env,
      dsn: options.dsn,
      sampleRate: options.sampleRate,
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed',
        'Non-Error exception captured with keys',
      ],
    });
    expect(sentrySetUser).toHaveBeenCalledWith({
      email: options.user?.email,
      id: String(options.user?.id),
    });
  });
});
