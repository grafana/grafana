import { dateTime, locationUtil, TimeRange, urlUtil, rangeUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SceneObjectRef, VizPanel } from '@grafana/scenes';
import { createShortLink } from 'app/core/utils/shortLinks';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';

import { contextSrv } from '../../../../core/services/context_srv';
import { PanelModel } from '../../state/PanelModel';

export interface BuildParamsArgs {
  useCurrentTimeRange: boolean;
  selectedTheme?: string;
  panel?: { timeFrom?: string; id: number };
  search?: string;
  range?: TimeRange;
  orgId?: number;
}

export function buildParams({
  useCurrentTimeRange,
  selectedTheme,
  panel,
  search = window.location.search,
  range = getTimeSrv().timeRange(),
  orgId = contextSrv.user.orgId,
}: BuildParamsArgs): URLSearchParams {
  const searchParams = new URLSearchParams(search);
  const relative = panel?.timeFrom;

  // Use panel's relative time if it's set
  if (relative) {
    const { from, to } = rangeUtil.describeTextRange(relative);
    searchParams.set('from', from);
    searchParams.set('to', to);
  } else {
    searchParams.set('from', String(range.from.valueOf()));
    searchParams.set('to', String(range.to.valueOf()));
  }
  searchParams.set('orgId', String(orgId));

  if (!useCurrentTimeRange) {
    searchParams.delete('from');
    searchParams.delete('to');
  }

  if (selectedTheme !== 'current') {
    searchParams.set('theme', selectedTheme!);
  }

  if (panel && !searchParams.has('editPanel')) {
    searchParams.set('viewPanel', String(panel.id));
  }

  // Token is unique to the authenticated identity and should not be shared with the URL,
  // so we are stripping it from the query params as a safety measure.
  searchParams.delete('auth_token');

  // The shareView param is used to indicate that the sharing modal is open and should never be included in the URL
  searchParams.delete('shareView');

  return searchParams;
}

export function buildBaseUrl() {
  let baseUrl = window.location.href;
  const queryStart = baseUrl.indexOf('?');

  if (queryStart !== -1) {
    baseUrl = baseUrl.substring(0, queryStart);
  }

  return baseUrl;
}

export async function buildShareUrl(
  useCurrentTimeRange: boolean,
  selectedTheme?: string,
  panel?: PanelModel,
  shortenUrl?: boolean
) {
  const baseUrl = buildBaseUrl();
  const params = buildParams({ useCurrentTimeRange, selectedTheme, panel });
  const shareUrl = urlUtil.appendQueryToUrl(baseUrl, params.toString());
  if (shortenUrl) {
    return await createShortLink(shareUrl);
  }
  return shareUrl;
}

export function buildSoloUrl(
  useCurrentTimeRange: boolean,
  dashboardUid: string,
  selectedTheme?: string,
  panel?: { timeFrom?: string; id: number },
  range?: TimeRange
) {
  const baseUrl = buildBaseUrl();
  const params = buildParams({ useCurrentTimeRange, selectedTheme, panel, range });

  let soloUrl = baseUrl.replace(config.appSubUrl + '/dashboard/', config.appSubUrl + '/dashboard-solo/');
  soloUrl = soloUrl.replace(config.appSubUrl + '/d/', config.appSubUrl + '/d-solo/');

  // For handling the case when default_home_dashboard_path is set in the grafana config
  const strippedUrl = locationUtil.stripBaseFromUrl(baseUrl);
  if (strippedUrl === '/') {
    soloUrl = `${config.appUrl}d-solo/${dashboardUid}`;
  }

  const panelId = params.get('editPanel') ?? params.get('viewPanel') ?? '';
  params.set('panelId', panelId);
  params.delete('editPanel');
  params.delete('viewPanel');

  return urlUtil.appendQueryToUrl(soloUrl, params.toString());
}

export function buildImageUrl(
  useCurrentTimeRange: boolean,
  dashboardUid: string,
  selectedTheme?: string,
  panel?: PanelModel
) {
  let soloUrl = buildSoloUrl(useCurrentTimeRange, dashboardUid, selectedTheme, panel);
  let imageUrl = soloUrl.replace(config.appSubUrl + '/dashboard-solo/', config.appSubUrl + '/render/dashboard-solo/');
  imageUrl = imageUrl.replace(config.appSubUrl + '/d-solo/', config.appSubUrl + '/render/d-solo/');
  imageUrl +=
    `&width=${config.rendererDefaultImageWidth}` +
    `&height=${config.rendererDefaultImageHeight}` +
    `&scale=${config.rendererDefaultImageScale}` +
    getLocalTimeZone();

  return imageUrl;
}

export function buildIframeHtml(
  useCurrentTimeRange: boolean,
  dashboardUid: string,
  selectedTheme?: string,
  panel?: { timeFrom?: string; id: number },
  range?: TimeRange
) {
  let soloUrl = buildSoloUrl(useCurrentTimeRange, dashboardUid, selectedTheme, panel, range);
  return `<iframe src="${soloUrl}" width="450" height="200" frameborder="0"></iframe>`;
}

export function getLocalTimeZone() {
  const utcOffset = '&tz=UTC' + encodeURIComponent(dateTime().format('Z'));

  // Older browser does not the internationalization API
  if (!window.Intl) {
    return utcOffset;
  }

  const dateFormat = window.Intl.DateTimeFormat();
  if (!dateFormat.resolvedOptions) {
    return utcOffset;
  }

  const options = dateFormat.resolvedOptions();
  if (!options.timeZone) {
    return utcOffset;
  }

  return '&tz=' + encodeURIComponent(options.timeZone);
}

export const getTrackingSource = (
  panel?: PanelModel | SceneObjectRef<VizPanel> | { timeFrom?: string; id: number }
) => {
  return panel ? 'panel' : 'dashboard';
};

export const shareDashboardType: {
  [key: string]: string;
} = {
  link: 'link',
  snapshot: 'snapshot',
  export: 'export',
  embed: 'embed',
  libraryPanel: 'library_panel',
  pdf: 'pdf',
  report: 'report',
  publicDashboard: 'public_dashboard',
  inviteUser: 'invite_user',
  image: 'image',
};
