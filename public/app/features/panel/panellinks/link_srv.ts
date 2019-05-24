import angular from 'angular';
import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import { appendQueryToUrl, toUrlParams } from 'app/core/utils/url';

export class LinkSrv {
  /** @ngInject */
  constructor(private templateSrv, private timeSrv) {}

  getLinkUrl(link) {
    const url = this.templateSrv.replace(link.url || '');
    const params = {};

    if (link.keepTime) {
      const range = this.timeSrv.timeRangeForUrl();
      params['from'] = range.from;
      params['to'] = range.to;
    }

    if (link.includeVars) {
      this.templateSrv.fillVariableValuesForUrl(params);
    }

    return appendQueryToUrl(url, toUrlParams(params));
  }

  getAnchorInfo(link) {
    const info: any = {};
    info.href = this.getLinkUrl(link);
    info.title = this.templateSrv.replace(link.title || '');
    return info;
  }

  getPanelLinkAnchorInfo(link, scopedVars) {
    const info: any = {};
    info.target = link.targetBlank ? '_blank' : '';
    if (link.type === 'absolute') {
      info.target = link.targetBlank ? '_blank' : '_self';
      info.href = this.templateSrv.replace(link.url || '', scopedVars);
      info.title = this.templateSrv.replace(link.title || '', scopedVars);
    } else if (link.url) {
      info.href = link.url;
      info.title = this.templateSrv.replace(link.title || '', scopedVars);
    } else if (link.dashUri) {
      info.href = 'dashboard/' + link.dashUri + '?';
      info.title = this.templateSrv.replace(link.title || '', scopedVars);
    } else {
      info.title = this.templateSrv.replace(link.title || '', scopedVars);
      const slug = kbn.slugifyForUrl(link.dashboard || '');
      info.href = 'dashboard/db/' + slug + '?';
    }

    const params = {};

    if (link.keepTime) {
      const range = this.timeSrv.timeRangeForUrl();
      params['from'] = range.from;
      params['to'] = range.to;
    }

    if (link.includeVars) {
      this.templateSrv.fillVariableValuesForUrl(params, scopedVars);
    }

    info.href = appendQueryToUrl(info.href, toUrlParams(params));

    if (link.params) {
      info.href = appendQueryToUrl(info.href, this.templateSrv.replace(link.params, scopedVars));
    }

    return info;
  }
}

angular.module('grafana.services').service('linkSrv', LinkSrv);
