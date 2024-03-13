import memoizeOne from 'memoize-one';

import { AbsoluteTimeRange, LogRowModel } from '@grafana/data';
import { getBackendSrv, config } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { dispatch } from 'app/store/store';

import { copyStringToClipboard } from './explore';

function buildHostUrl() {
  return `${window.location.protocol}//${window.location.host}${config.appSubUrl}`;
}

function getRelativeURLPath(url: string) {
  let path = url.replace(buildHostUrl(), '');
  return path.startsWith('/') ? path.substring(1, path.length) : path;
}

export const createShortLink = memoizeOne(async function (path: string) {
  try {
    const shortLink = await getBackendSrv().post(`/api/short-urls`, {
      path: getRelativeURLPath(path),
    });
    return shortLink.url;
  } catch (err) {
    console.error('Error when creating shortened link: ', err);
    dispatch(notifyApp(createErrorNotification('Error generating shortened link')));
  }
});

export const createAndCopyShortLink = async (path: string) => {
  const shortLink = await createShortLink(path);
  if (shortLink) {
    copyStringToClipboard(shortLink);
    dispatch(notifyApp(createSuccessNotification('Shortened link copied to clipboard')));
  } else {
    dispatch(notifyApp(createErrorNotification('Error generating shortened link')));
  }
};

function getPreviousLog(row: LogRowModel, allLogs: LogRowModel[]): LogRowModel | null {
  for (let i = allLogs.indexOf(row) - 1; i >= 0; i--) {
    if (allLogs[i].timeEpochMs > row.timeEpochMs) {
      return allLogs[i];
    }
  }

  return null;
}

export function getPermalinkRange(row: LogRowModel, rows: LogRowModel[], absoluteRange: AbsoluteTimeRange) {
  const range = {
    from: absoluteRange.from,
    to: absoluteRange.to,
  };
  if (!config.featureToggles.logsInfiniteScrolling) {
    return range;
  }

  // With infinite scrolling, the time range of the log line can be after the absolute range or beyond the request line limit, so we need to adjust
  // Look for the previous sibling log, and use its timestamp
  const allLogs = rows.filter((logRow) => logRow.dataFrame.refId === row.dataFrame.refId);
  const prevLog = getPreviousLog(row, allLogs);

  if (row.timeEpochMs > absoluteRange.to && !prevLog) {
    // Because there's no sibling and the current `to` is oldest than the log, we have no reference we can use for the interval
    // This only happens when you scroll into the future and you want to share the first log of the list
    return {
      from: absoluteRange.from,
      // Slide 1ms otherwise it's very likely to be omitted in the results
      to: row.timeEpochMs + 1,
    };
  }

  return {
    from: absoluteRange.from,
    to: prevLog ? prevLog.timeEpochMs : absoluteRange.to,
  };
}
