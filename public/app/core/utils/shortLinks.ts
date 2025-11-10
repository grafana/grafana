import memoizeOne from 'memoize-one';

import { AbsoluteTimeRange, LogRowModel, UrlQueryMap } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getBackendSrv, config, locationService } from '@grafana/runtime';
import { sceneGraph, SceneTimeRangeLike, VizPanel } from '@grafana/scenes';
import { shortURLAPIv1alpha1 } from 'app/api/clients/shorturl/v1alpha1';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { getDashboardUrl } from 'app/features/dashboard-scene/utils/getDashboardUrl';
import { dispatch } from 'app/store/store';

import { ShortURL } from '../../../../apps/shorturl/plugin/src/generated/shorturl/v1alpha1/shorturl_object_gen';
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

// Memoized legacy API call - preserves original behavior
const createShortLinkLegacy = memoizeOne(async (path: string): Promise<string> => {
  const shortLink = await getBackendSrv().post(`/api/short-urls`, {
    path: getRelativeURLPath(path),
  });
  return shortLink.url;
});

export const createShortLink = async function (path: string) {
  try {
    if (config.featureToggles.useKubernetesShortURLsAPI) {
      // Use RTK API - it handles caching/failures/retries automatically
      const result = await dispatch(
        shortURLAPIv1alpha1.endpoints.createShortUrl.initiate({
          shortUrl: {
            apiVersion: 'shorturl.grafana.app/v1alpha1',
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
      // Old API - use memoized function (preserves original behavior)
      return await createShortLinkLegacy(path);
    }
  } catch (err) {
    console.error('Error when creating shortened link: ', err);
    dispatch(notifyApp(createErrorNotification('Error generating shortened link')));
    throw err; // Re-throw so callers know it failed
  }
};

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
    urlParamsUpdate.viewPanel = panel.getPathId();
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
