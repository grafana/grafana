import memoizeOne from 'memoize-one';

import { UrlQueryMap } from '@grafana/data';
import { getBackendSrv, config, locationService } from '@grafana/runtime';
import { sceneGraph, SceneTimeRangeLike, VizPanel } from '@grafana/scenes';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { getDashboardUrl } from 'app/features/dashboard-scene/utils/urlBuilders';
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

export const createAndCopyDashboardShortLink = async (
  dashboard: DashboardScene,
  opts: { useAbsoluteTimeRange: boolean; theme: string },
  panel?: VizPanel
) => {
  const shareUrl = await createDashboardShareUrl(dashboard, opts, panel);
  await createAndCopyShortLink(shareUrl);
};

export const createDashboardShareUrl = async (
  dashboard: DashboardScene,
  opts: { useAbsoluteTimeRange: boolean; theme: string },
  panel?: VizPanel
) => {
  const location = locationService.getLocation();
  const timeRange = sceneGraph.getTimeRange(panel ?? dashboard);

  const urlParamsUpdate = getShareUrlParams(opts, timeRange, panel);

  return getDashboardUrl({
    uid: dashboard.state.uid,
    slug: dashboard.state.meta.slug,
    currentQueryParams: location.search,
    updateQuery: urlParamsUpdate,
    absolute: true,
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
