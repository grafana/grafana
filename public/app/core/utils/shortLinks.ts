import memoizeOne from 'memoize-one';

import { AbsoluteTimeRange, LogRowModel, UrlQueryMap } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getBackendSrv, config, locationService } from '@grafana/runtime';
import { sceneGraph, SceneTimeRangeLike, VizPanel } from '@grafana/scenes';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { getDashboardUrl } from 'app/features/dashboard-scene/utils/getDashboardUrl';
import { dispatch } from 'app/store/store';

import { ShareLinkConfiguration } from '../../features/dashboard-scene/sharing/ShareButton/utils';

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
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
    navigator.clipboard.write([createShortLinkClipboardItem(path)]);
    dispatch(notifyApp(createSuccessNotification('Shortened link copied to clipboard')));
  } else {
    const shortLink = await createShortLink(path);
    if (shortLink) {
      copyStringToClipboard(shortLink);
      dispatch(notifyApp(createSuccessNotification('Shortened link copied to clipboard')));
    } else {
      dispatch(notifyApp(createErrorNotification('Error generating shortened link')));
    }
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
  const timeRange = sceneGraph.getTimeRange(panel ?? dashboard);

  const urlParamsUpdate = getShareUrlParams(opts, timeRange, panel);

  return getDashboardUrl({
    uid: dashboard.state.uid,
    slug: dashboard.state.meta.slug,
    currentQueryParams: location.search,
    updateQuery: urlParamsUpdate,
    absolute: !opts.useShortUrl,
  });
};

export const getShareUrlParams = (
  opts: { useAbsoluteTimeRange: boolean; theme: string },
  timeRange: SceneTimeRangeLike,
  panel?: VizPanel
) => {
  const urlParamsUpdate: UrlQueryMap = {};

  if (panel) {
    urlParamsUpdate.viewPanel = panel.state.key;
  }

  if (opts.useAbsoluteTimeRange) {
    urlParamsUpdate.from = timeRange.state.value.from.toISOString();
    urlParamsUpdate.to = timeRange.state.value.to.toISOString();
  }

  if (opts.theme !== 'current') {
    urlParamsUpdate.theme = opts.theme;
  }

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
  const range = {
    from: new Date(absoluteRange.from).toISOString(),
    to: new Date(absoluteRange.to).toISOString(),
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
