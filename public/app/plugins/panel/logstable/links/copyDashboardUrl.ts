import { AbsoluteTimeRange, TimeRange, toUtc } from '@grafana/data';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { copyStringToClipboard } from 'app/core/utils/explore';
import { createShortLink, createShortLinkClipboardItem } from 'app/core/utils/shortLinks';
import { dispatch } from 'app/store/store';

export function copyLogsTableDashboardUrl(logId: string, timeRange: TimeRange): string | null {
  // this is an extra check, to be sure that we are not
  // creating permalinks for logs without an id-field.
  // normally it should never happen, because we do not
  // display the permalink button in such cases.
  if (logId === undefined) {
    return null;
  }

  // get panel state, add log-row-id
  const panelState = {
    logs: { id: logId },
  };

  // Grab the current dashboard URL
  const currentURL = new URL(window.location.href);

  // Add panel state containing the rowId, and absolute time range from the current query, but leave everything else the same, if the user is in edit mode when grabbing the link, that's what will be linked to, etc.
  currentURL.searchParams.set('panelState', JSON.stringify(panelState));
  const range: AbsoluteTimeRange = {
    from: toUtc(timeRange.from).valueOf(),
    to: toUtc(timeRange.to).valueOf(),
  };
  currentURL.searchParams.set('from', range.from.toString());
  currentURL.searchParams.set('to', range.to.toString());

  createAndCopyLogsTableShortLink(currentURL.toString());

  return currentURL.toString();
}

export const createAndCopyLogsTableShortLink = async (path: string) => {
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
      await navigator.clipboard.write([createShortLinkClipboardItem(path)]);
      dispatch(notifyApp(createSuccessNotification('Shortened link copied to clipboard')));
    } else {
      const shortLink = await createShortLink(path);
      copyStringToClipboard(shortLink);
      dispatch(notifyApp(createSuccessNotification('Shortened link copied to clipboard')));
      return shortLink;
    }
  } catch (error) {
    // createShortLink already handles error notifications, just log
    console.error('Error in createAndCopyShortLink:', error);
  }

  return Promise.resolve();
};
