import angular from 'angular';
import _ from 'lodash';
import kbn from 'app/core/utils/kbn';


export class LinkSrv {

  /** @ngInject */
  constructor(private templateSrv, private timeSrv) {
  }

  getLinkUrl(link) {
    var url = this.templateSrv.replace(link.url || '');
    var params = {};

    if (link.keepTime) {
      var range = this.timeSrv.timeRangeForUrl();
      params['from'] = range.from;
      params['to'] = range.to;
    }

    if (link.includeVars) {
      this.templateSrv.fillVariableValuesForUrl(params);
    }

    return this.addParamsToUrl(url, params);
  }

  addParamsToUrl(url, params) {
    var paramsArray = [];

    _.each(params, function(value, key) {
      if (value === null) { return; }
      if (value === true) {
        paramsArray.push(key);
      } else if (_.isArray(value)) {
        _.each(value, function(instance) {
          paramsArray.push(key + '=' + encodeURIComponent(instance));
        });
      } else {
        paramsArray.push(key + '=' + encodeURIComponent(value));
      }
    });

    if (paramsArray.length === 0) {
      return url;
    }

    return this.appendToQueryString(url, paramsArray.join('&'));
  }

  appendToQueryString(url, stringToAppend) {
    if (!_.isUndefined(stringToAppend) && stringToAppend !== null && stringToAppend !== '') {
      var pos = url.indexOf('?');
      if (pos !== -1) {
        if (url.length - pos > 1) {
          url += '&';
        }
      } else {
        url += '?';
      }
      url += stringToAppend;
    }

    return url;
  }

  getAnchorInfo(link) {
    var info = {};
    (<any>info).href = this.getLinkUrl(link);
    (<any>info).title = this.templateSrv.replace(link.title || '');
    return info;
  }

  getPanelLinkAnchorInfo(link, scopedVars) {
    var info = {};
    if (link.type === 'absolute') {
      (<any>info).target = link.targetBlank ? '_blank' : '_self';
      (<any>info).href = this.templateSrv.replace(link.url || '', scopedVars);
      (<any>info).title = this.templateSrv.replace(link.title || '', scopedVars);
    } else if (link.dashUri) {
      (<any>info).href = 'dashboard/' + link.dashUri + '?';
      (<any>info).title = this.templateSrv.replace(link.title || '', scopedVars);
      (<any>info).target = link.targetBlank ? '_blank' : '';
    } else {
      (<any>info).title = this.templateSrv.replace(link.title || '', scopedVars);
      var slug = kbn.slugifyForUrl(link.dashboard || '');
      (<any>info).href = 'dashboard/db/' + slug + '?';
    }

    var params = {};

    if (link.keepTime) {
      var range = this.timeSrv.timeRangeForUrl();
      params['from'] = range.from;
      params['to'] = range.to;
    }

    if (link.includeVars) {
      this.templateSrv.fillVariableValuesForUrl(params, scopedVars);
    }

    (<any>info).href = this.addParamsToUrl((<any>info).href, params);

    if (link.params) {
      (<any>info).href = this.appendToQueryString((<any>info).href, this.templateSrv.replace(link.params, scopedVars));
    }

    return info;
  }

}

angular.module('grafana.services').service('linkSrv', LinkSrv);
