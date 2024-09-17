import memoizeOne from 'memoize-one';

import { UrlQueryMap } from '@grafana/data';
import { getBackendSrv, config, locationService } from '@grafana/runtime';
import { sceneGraph, SceneTimeRangeLike, VizPanel } from '@grafana/scenes';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { getDashboardUrl } from 'app/features/dashboard-scene/utils/urlBuilders';
import { dispatch } from 'app/store/store';

import { ShareLinkConfiguration } from '../../features/dashboard-scene/sharing/ShareButton/utils';
import { t } from '../internationalization';

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
