import { LogRowModel } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SceneTimeRangeLike, VizPanel } from '@grafana/scenes';
import { createLogRow } from 'app/features/logs/components/mocks/logRow';

import { ShortURL } from '../../../../apps/shorturl/plugin/src/generated/shorturl/v1beta1/shorturl_object_gen';
import { defaultSpec } from '../../../../apps/shorturl/plugin/src/generated/shorturl/v1beta1/types.spec.gen';
import { defaultStatus } from '../../../../apps/shorturl/plugin/src/generated/shorturl/v1beta1/types.status.gen';

import {
  createShortLink,
  createAndCopyShortLink,
  getLogsPermalinkRange,
  buildShortUrl,
  getShareUrlParams,
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

describe('getLogsPermalinkRange', () => {
  let row: LogRowModel, rows: LogRowModel[];
  beforeEach(() => {
    config.featureToggles.logsInfiniteScrolling = true;
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
  afterAll(() => {
    config.featureToggles.logsInfiniteScrolling = false;
  });

  it('returns the original range if infinite scrolling is not enabled', () => {
    config.featureToggles.logsInfiniteScrolling = false;
    const range = {
      from: 1111111111111,
      to: 1111112222222,
    };
    const expectedRange = {
      from: new Date(1111111111111).toISOString(),
      to: new Date(1111112222222).toISOString(),
    };
    expect(getLogsPermalinkRange(row, [row], range)).toEqual(expectedRange);
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

describe('getShareUrlParams', () => {
  const mockTimeRange = {
    state: {
      value: {
        from: new Date('2024-01-01T00:00:00Z'),
        to: new Date('2024-01-01T06:00:00Z'),
      },
    },
  } as unknown as SceneTimeRangeLike;

  it('should include from and to when useAbsoluteTimeRange is true', () => {
    const params = getShareUrlParams({ useAbsoluteTimeRange: true, theme: 'current' }, mockTimeRange);

    expect(params.from).toBe('2024-01-01T00:00:00.000Z');
    expect(params.to).toBe('2024-01-01T06:00:00.000Z');
    expect(params.lockTimeRange).toBe('true');
  });

  it('should use relative time format when useAbsoluteTimeRange is false', () => {
    const mockTimeRangeWithRelative = {
      state: {
        value: {
          from: new Date('2024-01-01T00:00:00Z'),
          to: new Date('2024-01-01T06:00:00Z'),
          raw: {
            from: 'now-6h',
            to: 'now',
          },
        },
      },
    } as unknown as SceneTimeRangeLike;

    const params = getShareUrlParams({ useAbsoluteTimeRange: false, theme: 'current' }, mockTimeRangeWithRelative);

    expect(params.from).toBe('now-6h');
    expect(params.to).toBe('now');
    expect(params.lockTimeRange).toBe('false');
  });

  it('should include theme when theme is not current', () => {
    const mockTimeRangeWithRelative = {
      state: {
        value: {
          from: new Date('2024-01-01T00:00:00Z'),
          to: new Date('2024-01-01T06:00:00Z'),
          raw: {
            from: 'now-6h',
            to: 'now',
          },
        },
      },
    } as unknown as SceneTimeRangeLike;

    const params = getShareUrlParams({ useAbsoluteTimeRange: false, theme: 'dark' }, mockTimeRangeWithRelative);

    expect(params.theme).toBe('dark');
    expect(params.from).toBe('now-6h');
    expect(params.to).toBe('now');
    expect(params.lockTimeRange).toBe('false');
  });

  it('should include viewPanel when panel is provided', () => {
    const mockPanel = {
      getPathId: () => 'panel-123',
    } as unknown as VizPanel;

    const mockTimeRangeWithRelative = {
      state: {
        value: {
          from: new Date('2024-01-01T00:00:00Z'),
          to: new Date('2024-01-01T06:00:00Z'),
          raw: {
            from: 'now-6h',
            to: 'now',
          },
        },
      },
    } as unknown as SceneTimeRangeLike;

    const params = getShareUrlParams(
      { useAbsoluteTimeRange: false, theme: 'current' },
      mockTimeRangeWithRelative,
      mockPanel
    );

    expect(params.viewPanel).toBe('panel-123');
    expect(params.lockTimeRange).toBe('false');
  });

  it('should include lockTimeRange parameter to distinguish locked vs unlocked time ranges', () => {
    const mockTimeRangeWithRelative = {
      state: {
        value: {
          from: new Date('2024-01-01T00:00:00Z'),
          to: new Date('2024-01-01T06:00:00Z'),
          raw: {
            from: 'now-6h',
            to: 'now',
          },
        },
      },
    } as unknown as SceneTimeRangeLike;

    // Locked time range should have lockTimeRange=true and absolute timestamps
    const lockedParams = getShareUrlParams({ useAbsoluteTimeRange: true, theme: 'current' }, mockTimeRangeWithRelative);
    expect(lockedParams.lockTimeRange).toBe('true');
    expect(lockedParams.from).toBe('2024-01-01T00:00:00.000Z');
    expect(lockedParams.to).toBe('2024-01-01T06:00:00.000Z');

    // Unlocked time range should have lockTimeRange=false and relative timestamps
    const unlockedParams = getShareUrlParams(
      { useAbsoluteTimeRange: false, theme: 'current' },
      mockTimeRangeWithRelative
    );
    expect(unlockedParams.lockTimeRange).toBe('false');
    expect(unlockedParams.from).toBe('now-6h');
    expect(unlockedParams.to).toBe('now');
  });
});
