import angular, { ILocationService } from 'angular';
import config from 'app/core/config';
import { dateTime } from '@grafana/data';
import { appendQueryToUrl, toUrlParams } from 'app/core/utils/url';
import { TimeSrv } from '../../services/TimeSrv';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { LinkSrv } from 'app/features/panel/panellinks/link_srv';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';

/** @ngInject */
export function ShareModalCtrl(
  $scope: any,
  $rootScope: GrafanaRootScope,
  $location: ILocationService,
  $timeout: any,
  timeSrv: TimeSrv,
  templateSrv: TemplateSrv,
  linkSrv: LinkSrv
) {
  $scope.options = {
    forCurrent: true,
    includeTemplateVars: true,
    theme: 'current',
  };
  $scope.editor = { index: $scope.tabIndex || 0 };

  $scope.init = () => {
    $scope.panel = $scope.model && $scope.model.panel ? $scope.model.panel : $scope.panel; // React pass panel and dashboard in the "model" property
    $scope.dashboard = $scope.model && $scope.model.dashboard ? $scope.model.dashboard : $scope.dashboard; // ^
    $scope.modeSharePanel = $scope.panel ? true : false;

    $scope.tabs = [{ title: 'Link', src: 'shareLink.html' }];

    if ($scope.modeSharePanel) {
      $scope.modalTitle = 'Share Panel';
      $scope.tabs.push({ title: 'Embed', src: 'shareEmbed.html' });
    } else {
      $scope.modalTitle = 'Share';
    }

    if (!$scope.dashboard.meta.isSnapshot) {
      $scope.tabs.push({ title: 'Snapshot', src: 'shareSnapshot.html' });
    }

    if (!$scope.dashboard.meta.isSnapshot && !$scope.modeSharePanel) {
      $scope.tabs.push({ title: 'Export', src: 'shareExport.html' });
    }

    $scope.buildUrl();
  };

  $scope.buildUrl = () => {
    let baseUrl = $location.absUrl();
    const queryStart = baseUrl.indexOf('?');

    if (queryStart !== -1) {
      baseUrl = baseUrl.substring(0, queryStart);
    }

    const params = angular.copy($location.search());

    const range = timeSrv.timeRange();
    params.from = range.from.valueOf();
    params.to = range.to.valueOf();
    params.orgId = config.bootData.user.orgId;

    if ($scope.options.includeTemplateVars) {
      templateSrv.fillVariableValuesForUrl(params);
    }

    if (!$scope.options.forCurrent) {
      delete params.from;
      delete params.to;
    }

    if ($scope.options.theme !== 'current') {
      params.theme = $scope.options.theme;
    }

    if ($scope.modeSharePanel) {
      params.panelId = $scope.panel.id;
      params.fullscreen = true;
    } else {
      delete params.panelId;
      delete params.fullscreen;
    }

    $scope.shareUrl = appendQueryToUrl(baseUrl, toUrlParams(params));

    let soloUrl = baseUrl.replace(config.appSubUrl + '/dashboard/', config.appSubUrl + '/dashboard-solo/');
    soloUrl = soloUrl.replace(config.appSubUrl + '/d/', config.appSubUrl + '/d-solo/');
    delete params.fullscreen;
    delete params.edit;
    soloUrl = appendQueryToUrl(soloUrl, toUrlParams(params));

    $scope.iframeHtml = '<iframe src="' + soloUrl + '" width="450" height="200" frameborder="0"></iframe>';

    $scope.imageUrl = soloUrl.replace(
      config.appSubUrl + '/dashboard-solo/',
      config.appSubUrl + '/render/dashboard-solo/'
    );
    $scope.imageUrl = $scope.imageUrl.replace(config.appSubUrl + '/d-solo/', config.appSubUrl + '/render/d-solo/');
    $scope.imageUrl += '&width=1000&height=500' + $scope.getLocalTimeZone();
  };

  // This function will try to return the proper full name of the local timezone
  // Chrome does not handle the timezone offset (but phantomjs does)
  $scope.getLocalTimeZone = () => {
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
  };

  $scope.getShareUrl = () => {
    return $scope.shareUrl;
  };
}

angular.module('grafana.controllers').controller('ShareModalCtrl', ShareModalCtrl);
