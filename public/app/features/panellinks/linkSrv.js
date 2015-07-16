define([
  'angular',
  'kbn',
  'lodash',
],
function (angular, kbn, _) {
  'use strict';

  angular
    .module('grafana.services')
    .service('linkSrv', function(templateSrv, timeSrv) {

      this.getLinkUrl = function(link) {
        var url = templateSrv.replace(link.url || '');
        var params = {};

        if (link.keepTime) {
          var range = timeSrv.timeRangeForUrl();
          params['from'] = range.from;
          params['to'] = range.to;
        }

        if (link.includeVars) {
          templateSrv.fillVariableValuesForUrl(params);
        }

        return this.addParamsToUrl(url, params);
      };

      this.addParamsToUrl = function(url, params) {
        var paramsArray = [];
        _.each(params, function(value, key) {
          if (value === null) { return; }
          if (value === true) {
            paramsArray.push(key);
          }
          else if (_.isArray(value)) {
            _.each(value, function(instance) {
              paramsArray.push(key + '=' + encodeURIComponent(instance));
            });
          }
          else {
            paramsArray.push(key + '=' + encodeURIComponent(value));
          }
        });

        if (paramsArray.length === 0) {
          return url;
        }

        url += (url.indexOf('?') !== -1 ? '&' : '?');
        return url + paramsArray.join('&');
      };

      this.getAnchorInfo = function(link) {
        var info = {};
        info.href = this.getLinkUrl(link);
        info.title = templateSrv.replace(link.title || '');
        return info;
      };

      this.getPanelLinkAnchorInfo = function(link) {
        var info = {};
        if (link.type === 'absolute') {
          info.target = link.targetBlank ? '_blank' : '';
          info.href = templateSrv.replace(link.url || '');
          info.title = templateSrv.replace(link.title || '');
          info.href += '?';
        }
        else if (link.dashUri) {
          info.href = 'dashboard/' + link.dashUri + '?';
          info.title = templateSrv.replace(link.title || '');
          info.target = link.targetBlank ? '_blank' : '';
        }
        else {
          info.title = templateSrv.replace(link.title || '');
          var slug = kbn.slugifyForUrl(link.dashboard || '');
          info.href = 'dashboard/db/' + slug + '?';
        }

        var params = {};

        if (link.keepTime) {
          var range = timeSrv.timeRangeForUrl();
          params['from'] = range.from;
          params['to'] = range.to;
        }

        if (link.includeVars) {
          templateSrv.fillVariableValuesForUrl(params);
        }

        info.href = this.addParamsToUrl(info.href, params);
        if (link.params) {
          info.href += "&" + templateSrv.replace(link.params);
        }

        return info;
      };

    });
});
