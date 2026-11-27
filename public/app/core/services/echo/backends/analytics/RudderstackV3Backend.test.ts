import { type BuildInfo } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';

import { loadScript } from '../../utils';

import { RudderstackBackend } from './RudderstackV3Backend';

jest.mock('../../utils', () => ({ loadScript: jest.fn() }));

const buildInfo: BuildInfo = {
  buildstamp: 0,
  version: '12.0.0',
  commit: 'abc123',
  commitShort: 'abc',
  env: 'production',
  versionString: 'Grafana v12.0.0',
  edition: GrafanaEdition.OpenSource,
  latestVersion: '',
  hasUpdate: false,
  hideVersion: false,
};

describe('RudderstackBackend', () => {
  beforeEach(() => {
    window.rudderanalytics = undefined;
  });

  it.each([
    { batchInterval: 5000, enabled: true },
    { batchInterval: 0, enabled: false },
    { batchInterval: -1, enabled: false },
    { batchInterval: undefined, enabled: false },
  ])('sets batching to $enabled for a $batchInterval ms interval', ({ batchInterval, enabled }) => {
    new RudderstackBackend({
      writeKey: 'write-key',
      dataPlaneUrl: 'https://data-plane.example.com',
      buildInfo,
      batchInterval,
    });

    expect(loadScript).toHaveBeenCalledWith('https://cdn.rudderlabs.com/v3/modern/rsa.min.js');
    expect(window.rudderanalytics).toHaveProperty('load');
    expect(window.rudderanalytics?.load).toEqual(expect.any(Function));

    const calls = window.rudderanalytics as unknown as Array<[string, string, { queueOptions: { batch: unknown } }]>;
    expect(calls).toContainEqual([
      'load',
      'write-key',
      'https://data-plane.example.com',
      expect.objectContaining({
        queueOptions: {
          maxAttempts: 3,
          batch: {
            enabled,
            flushInterval: batchInterval ?? 0,
          },
        },
      }),
    ]);
  });
});
