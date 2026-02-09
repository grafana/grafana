import { AbsoluteTimeRange, TimeRange, toUtc } from '@grafana/data';
import { createAndCopyShortLink } from 'app/core/utils/shortLinks';

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

  createAndCopyShortLink(currentURL.toString());

  return currentURL.toString();
}
