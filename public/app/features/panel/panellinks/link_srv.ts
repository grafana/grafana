import angular from 'angular';
import _ from 'lodash';
import { appendQueryToUrl, toUrlParams } from 'app/core/utils/url';
import { PanelDrillDownLink, KeyValue } from '@grafana/ui';

const DrilldownLinkBuiltInVars = {
  keepTime: '__urlTimeRange',
  includeVars: '__allVariables',
};
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

  getPanelLinkAnchorInfo(link: PanelDrillDownLink, scopedVars) {
    const info: any = {};
    const params: KeyValue = {};
    info.target = link.targetBlank ? '_blank' : '';

    const timeRangeUrl = toUrlParams(this.timeSrv.timeRangeForUrl());

    info.href = link.url;
    info.title = this.templateSrv.replace(link.title || '', scopedVars);
    info.target = link.targetBlank ? '_blank' : '_self';
    this.templateSrv.fillVariableValuesForUrl(params, scopedVars);
    const variablesQuery = toUrlParams(params);

    info.href = this.templateSrv.replace(link.url, {
      ...scopedVars,
      [DrilldownLinkBuiltInVars.keepTime]: {
        text: timeRangeUrl,
        value: timeRangeUrl,
      },
      [DrilldownLinkBuiltInVars.includeVars]: {
        text: variablesQuery,
        value: variablesQuery,
      },
    });

    return info;
  }
}

angular.module('grafana.services').service('linkSrv', LinkSrv);
