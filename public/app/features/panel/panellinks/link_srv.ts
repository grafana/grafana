import angular from 'angular';
import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { ScopedVars } from '@grafana/ui/src/types/datasource';

export class LinkSrv {
  /** @ngInject */
  constructor(private templateSrv: TemplateSrv, private timeSrv: TimeSrv) {}

  getLinkUrl(link: any) {
    const url = this.templateSrv.replace(link.url || '');
    const params: { [key: string]: any } = {};

    if (link.keepTime) {
      const range = this.timeSrv.timeRangeForUrl();
      params['from'] = range.from;
      params['to'] = range.to;
    }

    if (link.includeVars) {
      this.templateSrv.fillVariableValuesForUrl(params);
    }

    return this.addParamsToUrl(url, params);
  }

  addParamsToUrl(url: string, params: any) {
    const paramsArray: Array<string | number> = [];

    _.each(params, (value, key) => {
      if (value === null) {
        return;
      }
      if (value === true) {
        paramsArray.push(key);
      } else if (_.isArray(value)) {
        _.each(value, instance => {
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

  appendToQueryString(url: string, stringToAppend: string) {
    if (!_.isUndefined(stringToAppend) && stringToAppend !== null && stringToAppend !== '') {
      const pos = url.indexOf('?');
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

  getAnchorInfo(link: any) {
    const info: any = {};
    info.href = this.getLinkUrl(link);
    info.title = this.templateSrv.replace(link.title || '');
    return info;
  }

  getPanelLinkAnchorInfo(link: any, scopedVars: ScopedVars) {
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

    const params: any = {};

    if (link.keepTime) {
      const range = this.timeSrv.timeRangeForUrl();
      params['from'] = range.from;
      params['to'] = range.to;
    }

    if (link.includeVars) {
      this.templateSrv.fillVariableValuesForUrl(params, scopedVars);
    }

    info.href = this.addParamsToUrl(info.href, params);

    if (link.params) {
      info.href = this.appendToQueryString(info.href, this.templateSrv.replace(link.params, scopedVars));
    }

    return info;
  }
}

angular.module('grafana.services').service('linkSrv', LinkSrv);
