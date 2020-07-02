import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { TemplateSrv } from 'app/features/templating/template_srv';
import coreModule from 'app/core/core_module';
import { getConfig } from 'app/core/config';
import {
  DataFrame,
  DataLinkBuiltInVars,
  deprecationWarning,
  KeyValue,
  LinkModel,
  locationUtil,
  ScopedVars,
  VariableOrigin,
  VariableSuggestion,
  VariableSuggestionsScope,
  urlUtil,
  textUtil,
  DataLink,
  PanelPlugin,
  getFieldVars,
  getDataFrameVars,
  valueVars,
  valueTimeVar,
  timeRangeVars,
  seriesVars,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

export const getPanelLinksVariableSuggestions = (): VariableSuggestion[] => [
  ...getTemplateSrv()
    .getVariables()
    .map(variable => ({
      value: variable.name as string,
      label: variable.name,
      origin: VariableOrigin.Template,
    })),
  {
    value: `${DataLinkBuiltInVars.includeVars}`,
    label: 'All variables',
    documentation: 'Adds current variables',
    origin: VariableOrigin.Template,
  },
  ...timeRangeVars,
];

export const getDataLinksVariableSuggestions = (
  dataFrames: DataFrame[],
  scope?: VariableSuggestionsScope
): VariableSuggestion[] => {
  const includeValueVars = scope === VariableSuggestionsScope.Values;

  return includeValueVars
    ? [
        ...seriesVars,
        ...getFieldVars(dataFrames),
        ...valueVars,
        valueTimeVar,
        ...getDataFrameVars(dataFrames),
        ...getPanelLinksVariableSuggestions(),
      ]
    : [
        ...seriesVars,
        ...getFieldVars(dataFrames),
        ...getDataFrameVars(dataFrames),
        ...getPanelLinksVariableSuggestions(),
      ];
};

export const getPanelOptionsVariableSuggestions = (plugin: PanelPlugin, data?: DataFrame[]): VariableSuggestion[] => {
  const dataVariables = plugin.meta.skipDataQuery ? [] : getDataFrameVars(data || []);
  return [
    ...dataVariables, // field values
    ...getTemplateSrv()
      .getVariables()
      .map(variable => ({
        value: variable.name as string,
        label: variable.name,
        origin: VariableOrigin.Template,
      })),
  ];
};

export interface LinkService {
  getDataLinkUIModel: <T>(link: DataLink, scopedVars: ScopedVars, origin: T) => LinkModel<T>;
  getAnchorInfo: (link: any) => any;
  getLinkUrl: (link: any) => string;
}

export class LinkSrv implements LinkService {
  /** @ngInject */
  constructor(private templateSrv: TemplateSrv, private timeSrv: TimeSrv) {}

  getLinkUrl(link: any) {
    let url = locationUtil.assureBaseUrl(this.templateSrv.replace(link.url || ''));
    const params: { [key: string]: any } = {};

    if (link.keepTime) {
      const range = this.timeSrv.timeRangeForUrl();
      params['from'] = range.from;
      params['to'] = range.to;
    }

    if (link.includeVars) {
      this.templateSrv.fillVariableValuesForUrl(params);
    }

    url = urlUtil.appendQueryToUrl(url, urlUtil.toUrlParams(params));
    return getConfig().disableSanitizeHtml ? url : textUtil.sanitizeUrl(url);
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
    const timeRangeUrl = urlUtil.toUrlParams(this.timeSrv.timeRangeForUrl());

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
      href: locationUtil.assureBaseUrl(href.replace(/\n/g, '')),
      title: this.templateSrv.replace(link.title || '', scopedVars),
      target: link.targetBlank ? '_blank' : '_self',
      origin,
      onClick,
    };

    this.templateSrv.fillVariableValuesForUrl(params, scopedVars);

    const variablesQuery = urlUtil.toUrlParams(params);

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

    info.href = getConfig().disableSanitizeHtml ? info.href : textUtil.sanitizeUrl(info.href);

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
