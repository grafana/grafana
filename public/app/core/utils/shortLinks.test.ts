import { LogRowModel } from '@grafana/data';
import { config } from '@grafana/runtime';
import { createLogRow } from 'app/features/logs/components/__mocks__/logRow';

import { createShortLink, createAndCopyShortLink, getLogsPermalinkRange } from './shortLinks';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => {
    return {
      post: () => {
        return Promise.resolve({ url: 'www.short.com' });
      },
    };
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
