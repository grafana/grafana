import memoizeOne from 'memoize-one';

import { AbsoluteTimeRange, dateTime, DateTime, isDateTime, LogRowModel, UrlQueryMap } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getBackendSrv, config, locationService } from '@grafana/runtime';
import { sceneGraph, SceneTimeRangeLike, VizPanel } from '@grafana/scenes';
import { shortURLAPIv1beta1 } from 'app/api/clients/shorturl/v1beta1';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { getDashboardUrl } from 'app/features/dashboard-scene/utils/getDashboardUrl';
import { dispatch } from 'app/store/store';

import { ShortURL } from '../../../../apps/shorturl/plugin/src/generated/shorturl/v1beta1/shorturl_object_gen';
import { extractErrorMessage } from '../../api/utils';
import { ShareLinkConfiguration } from '../../features/dashboard-scene/sharing/ShareButton/utils';

import { copyStringToClipboard } from './explore';

function buildHostUrl() {
  return `${window.location.protocol}//${window.location.host}${config.appSubUrl}`;
}

export function buildShortUrl(k8sShortUrl: ShortURL) {
  const key = k8sShortUrl.metadata.name;
  const orgId = k8sShortUrl.metadata.namespace;
  const hostUrl = buildHostUrl();
  return `${hostUrl}/goto/${key}?orgId=${orgId}`;
}

function getRelativeURLPath(url: string) {
  let path = url.replace(buildHostUrl(), '');
  return path.startsWith('/') ? path.substring(1, path.length) : path;
}

const createShortLinkLegacy = async (path: string): Promise<string> => {
  const shortLink = await getBackendSrv().post(`/api/short-urls`, {
    path: getRelativeURLPath(path),
  });
  return shortLink.url;
};

// Memoized API call, to not re-execute the same request multiple times
// this function creates a shortURL using the legacy or the new k8s api depending on the feature toggle
export const createShortLink = memoizeOne(async (path: string): Promise<string> => {
  try {
    if (config.featureToggles.useKubernetesShortURLsAPI) {
      // Use RTK API - it handles caching/failures/retries automatically
      const result = await dispatch(
        shortURLAPIv1beta1.endpoints.createShortUrl.initiate({
          shortUrl: {
            apiVersion: 'shorturl.grafana.app/v1beta1',
            kind: 'ShortURL',
            metadata: {},
            spec: {
              path: getRelativeURLPath(path),
            },
          },
        })
      );

      if ('data' in result && result.data) {
        return buildShortUrl(result.data);
      }

      if ('error' in result) {
        const errorMessage = extractErrorMessage(result.error);
        throw new Error(errorMessage || 'Failed to create short URL');
      }

      throw new Error('Failed to create short URL');
    } else {
      return await createShortLinkLegacy(path);
    }
  } catch (err) {
    console.error('Error when creating shortened link: ', err);
    dispatch(notifyApp(createErrorNotification('Error generating shortened link')));
    throw err; // Re-throw so callers know it failed
  }
});

/**
 * Creates a ClipboardItem for the shortened link. This is used due to clipboard issues in Safari after making async calls.
 * See https://github.com/grafana/grafana/issues/106889
 * @param path - The long path to share.
 * @returns A ClipboardItem for the shortened link.
 */
const createShortLinkClipboardItem = (path: string) => {
  return new ClipboardItem({
    'text/plain': createShortLink(path),
  });
};

export const createAndCopyShortLink = async (path: string) => {
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
      await navigator.clipboard.write([createShortLinkClipboardItem(path)]);
      dispatch(notifyApp(createSuccessNotification('Shortened link copied to clipboard')));
    } else {
      const shortLink = await createShortLink(path);
      copyStringToClipboard(shortLink);
      dispatch(notifyApp(createSuccessNotification('Shortened link copied to clipboard')));
    }
  } catch (error) {
    // createShortLink already handles error notifications, just log
    console.error('Error in createAndCopyShortLink:', error);
  }
};

export const createAndCopyShareDashboardLink = async (
  dashboard: DashboardScene,
  opts: ShareLinkConfiguration,
  panel?: VizPanel
) => {
  const shareUrl = createDashboardShareUrl(dashboard, opts, panel);
  if (opts.useShortUrl) {
    return await createAndCopyShortLink(shareUrl);
  } else {
    copyStringToClipboard(shareUrl);
    dispatch(notifyApp(createSuccessNotification(t('link.share.copy-to-clipboard', 'Link copied to clipboard'))));
  }
};

export const createDashboardShareUrl = (dashboard: DashboardScene, opts: ShareLinkConfiguration, panel?: VizPanel) => {
  const location = locationService.getLocation();
  // Get the current time range from the scene graph - this is always up-to-date
  // and reflects any changes the user has made to the dashboard time range
  // We access the state directly each time to ensure we get the latest values
  const timeRangeObj = sceneGraph.getTimeRange(panel ?? dashboard);

  const urlParamsUpdate = getShareUrlParams(opts, timeRangeObj, panel);

  // Remove time params from currentQueryParams to avoid conflicts with the time range from scene graph
  // We always use the time range from the scene graph (or remove it if useAbsoluteTimeRange is false)
  // Never use stale time params from location.search
  let currentQueryParams = location.search;
  // Always remove time params from currentQueryParams - we'll add them back if needed via updateQuery
  const params = new URLSearchParams(currentQueryParams);
  params.delete('from');
  params.delete('to');
  currentQueryParams = params.toString() ? `?${params.toString()}` : '';

  return getDashboardUrl({
    uid: dashboard.state.uid,
    slug: dashboard.state.meta.slug,
    currentQueryParams: currentQueryParams,
    updateQuery: urlParamsUpdate,
    absolute: !opts.useShortUrl,
  });
};

/**
 * Converts a time value to relative format (e.g., now-24h, now) if it's an absolute timestamp.
 * If it's already a string (relative format), returns it as-is.
 * Only converts recent timestamps (within last 24 hours) to relative format.
 */
function convertToRelativeTime(timeValue: string | DateTime | number): string {
  // If it's already a string, assume it's relative format
  if (typeof timeValue === 'string') {
    return timeValue;
  }

  // Convert to DateTime if it's a number (epoch milliseconds)
  const dateTimeValue = typeof timeValue === 'number' ? dateTime(timeValue) : timeValue;

  if (!isDateTime(dateTimeValue)) {
    return String(timeValue);
  }

  const now = dateTime();
  const diff = now.diff(dateTimeValue);

  // Only convert recent timestamps (within last 24 hours) to relative format
  // Older timestamps should stay as absolute
  if (Math.abs(diff) > 24 * 60 * 60 * 1000) {
    return dateTimeValue.toISOString();
  }

  // Calculate offset in minutes
  const offsetMinutes = Math.round(diff / (60 * 1000));

  if (offsetMinutes === 0) {
    return 'now';
  }

  // Convert to relative format
  if (Math.abs(offsetMinutes) < 60) {
    return `now${offsetMinutes > 0 ? '-' : '+'}${Math.abs(offsetMinutes)}m`;
  } else {
    const hours = Math.round(offsetMinutes / 60);
    return `now${hours > 0 ? '-' : '+'}${Math.abs(hours)}h`;
  }
}

export const getShareUrlParams = (
  opts: { useAbsoluteTimeRange: boolean; theme: string },
  timeRange: SceneTimeRangeLike,
  panel?: VizPanel
) => {
  const urlParamsUpdate: UrlQueryMap = {};

  if (panel) {
    urlParamsUpdate.viewPanel = panel.getPathId();
  }

  // Access state.value directly to ensure we get the latest time range values
  // Access the state synchronously at this exact moment to get the current time range
  // Note: timeRange.state is reactive, so accessing .value here gets the current state
  const currentTimeRange = timeRange.state.value;

  if (opts.useAbsoluteTimeRange) {
    // Lock time range: use absolute ISO timestamps
    // This converts relative time ranges (e.g., now-24h) to absolute timestamps
    urlParamsUpdate.from = currentTimeRange.from.toISOString();
    urlParamsUpdate.to = currentTimeRange.to.toISOString();
  } else {
    // Don't lock time range: use relative time format (e.g., now-24h, now)
    // This preserves the current time range but as relative, so it updates when the dashboard is opened
    const raw = currentTimeRange.raw;

    // Convert to relative format if needed
    urlParamsUpdate.from = convertToRelativeTime(raw.from);
    urlParamsUpdate.to = convertToRelativeTime(raw.to);
  }

  if (opts.theme !== 'current') {
    urlParamsUpdate.theme = opts.theme;
  }

  // Include lock time range state in URL to ensure different short URLs for locked vs unlocked
  // This allows de-duplication within the same lock state, but different URLs for different states
  urlParamsUpdate.lockTimeRange = opts.useAbsoluteTimeRange ? 'true' : 'false';

  return urlParamsUpdate;
};

function getPreviousLog(row: LogRowModel, allLogs: LogRowModel[]): LogRowModel | null {
  for (let i = allLogs.indexOf(row) - 1; i >= 0; i--) {
    if (allLogs[i].timeEpochMs > row.timeEpochMs) {
      return allLogs[i];
    }
  }

  return null;
}

export function getLogsPermalinkRange(row: LogRowModel, rows: LogRowModel[], absoluteRange: AbsoluteTimeRange) {
  // With infinite scrolling, the time range of the log line can be after the absolute range or beyond the request line limit, so we need to adjust
  // Look for the previous sibling log, and use its timestamp
  const allLogs = rows.filter((logRow) => logRow.dataFrame.refId === row.dataFrame.refId);
  const prevLog = getPreviousLog(row, allLogs);

  if (row.timeEpochMs > absoluteRange.to && !prevLog) {
    // Because there's no sibling and the current `to` is oldest than the log, we have no reference we can use for the interval
    // This only happens when you scroll into the future and you want to share the first log of the list
    return {
      from: new Date(absoluteRange.from).toISOString(),
      // Slide 1ms otherwise it's very likely to be omitted in the results
      to: new Date(row.timeEpochMs + 1).toISOString(),
    };
  }

  return {
    from: new Date(absoluteRange.from).toISOString(),
    to: new Date(prevLog ? prevLog.timeEpochMs : absoluteRange.to).toISOString(),
  };
}
