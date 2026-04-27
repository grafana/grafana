import type { LogRowModel } from '@grafana/data/types';
import { config, locationService } from '@grafana/runtime';
import { SceneTimeRange } from '@grafana/scenes';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { createLogRow } from 'app/features/logs/components/mocks/logRow';

import { type ShortURL } from '../../../../apps/shorturl/plugin/src/generated/shorturl/v1beta1/shorturl_object_gen';
import { defaultSpec } from '../../../../apps/shorturl/plugin/src/generated/shorturl/v1beta1/types.spec.gen';
import { defaultStatus } from '../../../../apps/shorturl/plugin/src/generated/shorturl/v1beta1/types.status.gen';

import {
  createShortLink,
  createAndCopyShortLink,
  createDashboardShareUrl,
  getLogsPermalinkRange,
  buildShortUrl,
} from './shortLinks';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => {
    return {
      post: () => {
        return Promise.resolve({ url: 'https://www.test.grafana.com/goto/bewyw48durgu8d?orgId=1' });
      },
    };
  },
}));

jest.mock('app/store/store', () => ({
  dispatch: jest.fn((action) => {
    // Return the mocked result directly
    return Promise.resolve({
      data: {
        metadata: {
          name: 'bewyw48durgu8d',
          namespace: '1',
        },
      },
    });
  }),
}));

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: {
      write: jest.fn().mockResolvedValue(undefined),
      writeText: jest.fn().mockResolvedValue(undefined),
    },
  });

  document.execCommand = jest.fn();
  config.featureToggles.useKubernetesShortURLsAPI = false;

  // clear memoizeOne function
  if ('clear' in createShortLink) {
    (createShortLink as { clear: () => void }).clear();
  }

  // Clear any caches between tests
  jest.clearAllMocks();
});

describe('createShortLink', () => {
  it('creates short link', async () => {
    const shortUrl = await createShortLink('d/edhmipji89b0gb/welcome?orgId=1&from=now-6h&to=now&timezone=browser');
    expect(shortUrl).toBe('https://www.test.grafana.com/goto/bewyw48durgu8d?orgId=1');
  });
});

describe('createShortLink using k8s API', () => {
  it('creates short link', async () => {
    // Mock window.location for k8s API test
    const mockLocation = {
      protocol: 'https:',
      host: 'www.test.grafana.com',
    };
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
    });

    config.featureToggles.useKubernetesShortURLsAPI = true;
    const shortUrl = await createShortLink('d/edhmipji89b0gb/welcome?orgId=1&from=now-6h&to=now&timezone=browser');
    expect(shortUrl).toBe('https://www.test.grafana.com/goto/bewyw48durgu8d?orgId=1');
  });
});

describe('createShortLink retries after failure', () => {
  it('retries after k8s API failure instead of returning cached rejection', async () => {
    jest.spyOn(console, 'error').mockImplementation();

    config.featureToggles.useKubernetesShortURLsAPI = true;

    const mockLocation = { protocol: 'https:', host: 'www.test.grafana.com' };
    Object.defineProperty(window, 'location', { value: mockLocation, writable: true });

    const { dispatch } = require('app/store/store');
    // dispatch is called for: 1) initiate (fail), 2) notifyApp (error), 3) initiate (success)
    dispatch
      .mockResolvedValueOnce({ error: { status: 504, data: { message: 'gateway timeout' } } })
      .mockReturnValueOnce(undefined) // notifyApp error notification
      .mockResolvedValueOnce({
        data: {
          metadata: { name: 'retried123', namespace: '1' },
        },
      });

    const path = 'd/test/dashboard?orgId=1';

    // First call should fail
    await expect(createShortLink(path)).rejects.toThrow();

    // Second call with same path should retry, not return cached rejection
    const result = await createShortLink(path);
    expect(result).toBe('https://www.test.grafana.com/goto/retried123?orgId=1');
  });
});

describe('createAndCopyShortLink', () => {
  it('copies short link to clipboard via document.execCommand when navigator.clipboard is undefined', async () => {
    Object.assign(navigator, {
      clipboard: {
        write: undefined,
      },
    });
    document.execCommand = jest.fn();
    await createAndCopyShortLink('www.test.grafana.com');
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });

  it('copies short link to clipboard via navigator.clipboard.writeText when ClipboardItem is undefined', async () => {
    window.isSecureContext = true;
    await createAndCopyShortLink('d/edhmipji89b0gb/welcome?orgId=1&from=now-6h&to=now&timezone=browser');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://www.test.grafana.com/goto/bewyw48durgu8d?orgId=1'
    );
  });

  it('copies short link to clipboard via navigator.clipboard.write and ClipboardItem when it is defined', async () => {
    global.ClipboardItem = jest.fn().mockImplementation(() => ({
      type: 'text/plain',
      size: 0,
      slice: jest.fn(),
      supports: jest.fn().mockReturnValue(true),
      // eslint-disable-next-line
    })) as any;
    await createAndCopyShortLink('d/edhmipji89b0gb/welcome?orgId=1&from=now-6h&to=now&timezone=browser');
    expect(navigator.clipboard.write).toHaveBeenCalled();
  });
});

describe('buildShortUrl', () => {
  // Mock window.location
  const mockLocation = {
    protocol: 'https:',
    host: 'grafana.example.com',
  };

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
    });
    config.appSubUrl = '';
  });

  it('builds short URL with metadata name and namespace', () => {
    const shortUrl: ShortURL = {
      kind: 'ShortURL',
      apiVersion: 'shorturl.grafana.app/v1beta1',
      metadata: {
        name: 'abc123def',
        namespace: 'org-5',
      },
      spec: defaultSpec(),
      status: defaultStatus(),
    };

    const result = buildShortUrl(shortUrl);
    expect(result).toBe('https://grafana.example.com/goto/abc123def?orgId=org-5');
  });

  it('builds short URL with appSubUrl configured', () => {
    config.appSubUrl = '/grafana';

    const shortUrl: ShortURL = {
      kind: 'ShortURL',
      apiVersion: 'shorturl.grafana.app/v1beta1',
      metadata: {
        name: 'xyz789',
        namespace: 'org-1',
      },
      spec: defaultSpec(),
      status: defaultStatus(),
    };

    const result = buildShortUrl(shortUrl);
    expect(result).toBe('https://grafana.example.com/grafana/goto/xyz789?orgId=org-1');
  });
});

describe('createDashboardShareUrl', () => {
  const opts = { useAbsoluteTimeRange: false, theme: 'current', useShortUrl: true };

  it('uses snapshotKey as the URL identifier for snapshot dashboards', () => {
    locationService.push('/dashboard/snapshot/the-real-snapshot-key?orgId=1');

    const dashboard = new DashboardScene({
      uid: 'original-dashboard-uid',
      meta: { isSnapshot: true, snapshotKey: 'the-real-snapshot-key' },
      $timeRange: new SceneTimeRange({}),
    });

    const url = createDashboardShareUrl(dashboard, opts);

    expect(url).toContain('/dashboard/snapshot/the-real-snapshot-key');
    expect(url).not.toContain('original-dashboard-uid');
  });

  it('does not append slug to snapshot URLs', () => {
    locationService.push('/dashboard/snapshot/the-real-snapshot-key?orgId=1');

    const dashboard = new DashboardScene({
      uid: 'original-dashboard-uid',
      meta: { isSnapshot: true, snapshotKey: 'the-real-snapshot-key', slug: 'some-slug' },
      $timeRange: new SceneTimeRange({}),
    });

    const url = createDashboardShareUrl(dashboard, opts);

    expect(url).toBe('/dashboard/snapshot/the-real-snapshot-key?orgId=1');
  });

  it('falls back to uid if snapshotKey is missing', () => {
    locationService.push('/dashboard/snapshot/some-key?orgId=1');

    const dashboard = new DashboardScene({
      uid: 'original-dashboard-uid',
      meta: { isSnapshot: true },
      $timeRange: new SceneTimeRange({}),
    });

    const url = createDashboardShareUrl(dashboard, opts);

    expect(url).toBe('/dashboard/snapshot/original-dashboard-uid?orgId=1');
  });

  it('uses uid and slug for regular dashboards', () => {
    locationService.push('/d/original-dashboard-uid/my-dashboard?orgId=1');

    const dashboard = new DashboardScene({
      uid: 'original-dashboard-uid',
      meta: { isSnapshot: false, slug: 'my-dashboard' },
      $timeRange: new SceneTimeRange({}),
    });

    const url = createDashboardShareUrl(dashboard, opts);

    expect(url).toBe('/d/original-dashboard-uid/my-dashboard?orgId=1');
  });
});

describe('getLogsPermalinkRange', () => {
  let row: LogRowModel, rows: LogRowModel[];
  beforeEach(() => {
    row = createLogRow({
      timeEpochMs: 1111112222222,
    });
    rows = [
      createLogRow({
        timeEpochMs: 1111113333333,
      }),
      row,
    ];
  });

  it('returns the range relative to the previous log line', () => {
    const range = {
      from: 1111111111111,
      to: 1111114444444,
    };
    expect(getLogsPermalinkRange(row, rows, range)).toEqual({
      from: '2005-03-18T01:58:31.111Z',
      to: '2005-03-18T02:35:33.333Z',
    });
  });

  it('returns the range relative to the previous log line', () => {
    const range = {
      from: 1111111111110,
      to: 1111111111111,
    };
    expect(getLogsPermalinkRange(row, [row], range)).toEqual({
      from: '2005-03-18T01:58:31.110Z',
      to: '2005-03-18T02:17:02.223Z',
    });
  });
});
