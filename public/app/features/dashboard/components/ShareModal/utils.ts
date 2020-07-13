import { config } from '@grafana/runtime';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import templateSrv from 'app/features/templating/template_srv';
import { PanelModel, dateTime, urlUtil } from '@grafana/data';

export function buildParams(
  useCurrentTimeRange: boolean,
  includeTemplateVars: boolean,
  selectedTheme?: string,
  panel?: PanelModel
) {
  const params = urlUtil.getUrlSearchParams();

  const range = getTimeSrv().timeRange();
  params.from = range.from.valueOf();
  params.to = range.to.valueOf();
  params.orgId = config.bootData.user.orgId;

  if (!useCurrentTimeRange) {
    delete params.from;
    delete params.to;
  }

  if (includeTemplateVars) {
    templateSrv.fillVariableValuesForUrl(params);
  }

  if (selectedTheme !== 'current') {
    params.theme = selectedTheme;
  }

  if (panel && !params.editPanel) {
    params.viewPanel = panel.id;
  } else {
    delete params.viewPanel;
  }

  return params;
}

export function buildBaseUrl() {
  let baseUrl = window.location.href;
  const queryStart = baseUrl.indexOf('?');

  if (queryStart !== -1) {
    baseUrl = baseUrl.substring(0, queryStart);
  }

  return baseUrl;
}

export function buildShareUrl(
  useCurrentTimeRange: boolean,
  includeTemplateVars: boolean,
  selectedTheme?: string,
  panel?: PanelModel
) {
  const baseUrl = buildBaseUrl();
  const params = buildParams(useCurrentTimeRange, includeTemplateVars, selectedTheme, panel);

  return urlUtil.appendQueryToUrl(baseUrl, urlUtil.toUrlParams(params));
}

export function buildSoloUrl(
  useCurrentTimeRange: boolean,
  includeTemplateVars: boolean,
  selectedTheme?: string,
  panel?: PanelModel
) {
  const baseUrl = buildBaseUrl();
  const params = buildParams(useCurrentTimeRange, includeTemplateVars, selectedTheme, panel);

  let soloUrl = baseUrl.replace(config.appSubUrl + '/dashboard/', config.appSubUrl + '/dashboard-solo/');
  soloUrl = soloUrl.replace(config.appSubUrl + '/d/', config.appSubUrl + '/d-solo/');

  params.panelId = params.editPanel ?? params.viewPanel;
  delete params.editPanel;
  delete params.viewPanel;

  return urlUtil.appendQueryToUrl(soloUrl, urlUtil.toUrlParams(params));
}

export function buildImageUrl(
  useCurrentTimeRange: boolean,
  includeTemplateVars: boolean,
  selectedTheme?: string,
  panel?: PanelModel
) {
  let soloUrl = buildSoloUrl(useCurrentTimeRange, includeTemplateVars, selectedTheme, panel);

  let imageUrl = soloUrl.replace(config.appSubUrl + '/dashboard-solo/', config.appSubUrl + '/render/dashboard-solo/');
  imageUrl = imageUrl.replace(config.appSubUrl + '/d-solo/', config.appSubUrl + '/render/d-solo/');
  imageUrl += '&width=1000&height=500' + getLocalTimeZone();
  return imageUrl;
}

export function buildIframeHtml(
  useCurrentTimeRange: boolean,
  includeTemplateVars: boolean,
  selectedTheme?: string,
  panel?: PanelModel
) {
  let soloUrl = buildSoloUrl(useCurrentTimeRange, includeTemplateVars, selectedTheme, panel);
  return '<iframe src="' + soloUrl + '" width="450" height="200" frameborder="0"></iframe>';
}

export function getLocalTimeZone() {
  const utcOffset = '&tz=UTC' + encodeURIComponent(dateTime().format('Z'));

  // Older browser does not the internationalization API
  if (!(window as any).Intl) {
    return utcOffset;
  }

  const dateFormat = (window as any).Intl.DateTimeFormat();
  if (!dateFormat.resolvedOptions) {
    return utcOffset;
  }

  const options = dateFormat.resolvedOptions();
  if (!options.timeZone) {
    return utcOffset;
  }

  return '&tz=' + encodeURIComponent(options.timeZone);
}
