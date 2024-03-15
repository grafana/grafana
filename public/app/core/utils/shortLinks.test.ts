import { LogRowModel } from '@grafana/data';
import { config } from '@grafana/runtime';
import { createLogRow } from 'app/features/logs/components/__mocks__/logRow';

import { createShortLink, createAndCopyShortLink, getPermalinkRange } from './shortLinks';

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => {
    return {
      post: () => {
        return Promise.resolve({ url: 'www.short.com' });
      },
    };
  },
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    appSubUrl: '',
  },
}));

describe('createShortLink', () => {
  it('creates short link', async () => {
    const shortUrl = await createShortLink('www.verylonglinkwehavehere.com');
    expect(shortUrl).toBe('www.short.com');
  });
});

describe('createAndCopyShortLink', () => {
  it('copies short link to clipboard', async () => {
    document.execCommand = jest.fn();
    await createAndCopyShortLink('www.verylonglinkwehavehere.com');
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });
});

describe('getPermalinkRange', () => {
  let row: LogRowModel, rows: LogRowModel[];
  beforeEach(() => {
    config.featureToggles.logsInfiniteScrolling = true;
    row = createLogRow({
      timeEpochMs: 2,
    });
    rows = [
      createLogRow({
        timeEpochMs: 3,
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
      from: 1,
      to: 2,
    };
    expect(getPermalinkRange(row, [row], range)).toEqual(range);
  });

  it('returns the range relative to the previous log line', () => {
    const range = {
      from: 1,
      to: 4,
    };
    expect(getPermalinkRange(row, rows, range)).toEqual({
      from: 1,
      to: 3,
    });
  });

  it('returns the range relative to the previous log line', () => {
    const range = {
      from: 0,
      to: 1,
    };
    expect(getPermalinkRange(row, [row], range)).toEqual({
      from: 0,
      to: 3,
    });
  });
});
