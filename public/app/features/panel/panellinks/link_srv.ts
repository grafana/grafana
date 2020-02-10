import _ from 'lodash';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { TemplateSrv } from 'app/features/templating/template_srv';
import coreModule from 'app/core/core_module';
import { appendQueryToUrl, toUrlParams } from 'app/core/utils/url';
import { sanitizeUrl } from 'app/core/utils/text';
import { getConfig } from 'app/core/config';
import { DataLink, KeyValue, deprecationWarning, LinkModel, ScopedVars, DataLinkBuiltInVars } from '@grafana/data';

export interface LinkService {
  getDataLinkUIModel: <T>(link: DataLink, scopedVars: ScopedVars, origin: T) => LinkModel<T>;
}

export class LinkSrv implements LinkService {
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

    return appendQueryToUrl(url, toUrlParams(params));
  }

  getAnchorInfo(link: any) {
    const info: any = {};
    info.href = this.getLinkUrl(link);
    info.title = this.templateSrv.replace(link.title || '');
    return info;
  }

  /**
   * Returns LinkModel which is basically a DataLink with all values interpolated through the templateSrv.
   */
  getDataLinkUIModel = <T>(link: DataLink, scopedVars: ScopedVars, origin: T): LinkModel<T> => {
    const params: KeyValue = {};
    const timeRangeUrl = toUrlParams(this.timeSrv.timeRangeForUrl());

    let href = link.url;
    if (link.onBuildUrl) {
      href = link.onBuildUrl({
        origin,
        scopedVars,
      });
    }

    let onClick: (e: any) => void = undefined;
    if (link.onClick) {
      onClick = (e: any) => {
        link.onClick({
          origin,
          scopedVars,
          e,
        });
      };
    }

    const info: LinkModel<T> = {
      href: href.replace(/\s|\n/g, ''),
      title: this.templateSrv.replace(link.title || '', scopedVars),
      target: link.targetBlank ? '_blank' : '_self',
      origin,
      onClick,
    };
    this.templateSrv.fillVariableValuesForUrl(params, scopedVars);

    const variablesQuery = toUrlParams(params);
    info.href = this.templateSrv.replace(info.href, {
      ...scopedVars,
      [DataLinkBuiltInVars.keepTime]: {
        text: timeRangeUrl,
        value: timeRangeUrl,
      },
      [DataLinkBuiltInVars.includeVars]: {
        text: variablesQuery,
        value: variablesQuery,
      },
    });
    info.href = getConfig().disableSanitizeHtml ? info.href : sanitizeUrl(info.href);
    return info;
  };

  /**
   * getPanelLinkAnchorInfo method is left for plugins compatibility reasons
   *
   * @deprecated Drilldown links should be generated using getDataLinkUIModel method
   */
  getPanelLinkAnchorInfo(link: DataLink, scopedVars: ScopedVars) {
    deprecationWarning('link_srv.ts', 'getPanelLinkAnchorInfo', 'getDataLinkUIModel');
    return this.getDataLinkUIModel(link, scopedVars, {});
  }
}

let singleton: LinkService;

export function setLinkSrv(srv: LinkService) {
  singleton = srv;
}

export function getLinkSrv(): LinkService {
  return singleton;
}

coreModule.service('linkSrv', LinkSrv);
