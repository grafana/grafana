import _ from 'lodash';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import templateSrv, { TemplateSrv } from 'app/features/templating/template_srv';
import coreModule from 'app/core/core_module';
import { appendQueryToUrl, toUrlParams } from 'app/core/utils/url';
import { VariableSuggestion, ScopedVars, VariableOrigin, DataLinkBuiltInVars } from '@grafana/ui';
import { DataLink, KeyValue, deprecationWarning, LinkModel, DataFrame } from '@grafana/data';

export const getPanelLinksVariableSuggestions = (): VariableSuggestion[] => [
  ...templateSrv.variables.map(variable => ({
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
  {
    value: `${DataLinkBuiltInVars.keepTime}`,
    label: 'Current time range',
    documentation: 'Adds current time range',
    origin: VariableOrigin.BuiltIn,
  },
];

export const getDataLinksVariableSuggestions = (dataFrames: DataFrame[]): VariableSuggestion[] => {
  const labels = _.flatten(dataFrames.map(df => Object.keys(df.labels || {})));

  const seriesVars = [
    {
      value: `${DataLinkBuiltInVars.seriesName}`,
      label: 'Name',
      documentation: 'Name of the series',
      origin: VariableOrigin.Series,
    },
    {
      value: `${DataLinkBuiltInVars.seriesRefId}`,
      label: 'RefId',
      documentation: 'Series refId',
      origin: VariableOrigin.Series,
    },
    ...labels.map(label => ({
      value: `__series.labels.${label}`,
      label: `Label: ${label}`,
      documentation: 'Adds series name',
      origin: VariableOrigin.Series,
    })),
  ];

  const fieldVars = [
    {
      value: `${DataLinkBuiltInVars.fieldName}`,
      label: 'Name',
      documentation: 'Time value of the clicked datapoint (in ms epoch)',
      origin: VariableOrigin.Field,
    },
  ];

  const valueVars = [
    {
      value: `${DataLinkBuiltInVars.valueTime}`,
      label: 'Time',
      documentation: 'Time value of the clicked datapoint (in ms epoch)',
      origin: VariableOrigin.Value,
    },
  ];

  return [...seriesVars, ...fieldVars, ...valueVars, ...getPanelLinksVariableSuggestions()];
};

export const getCalculationValueDataLinksVariableSuggestions = (): VariableSuggestion[] => [
  ...getPanelLinksVariableSuggestions(),
  {
    value: `${DataLinkBuiltInVars.seriesName}`,
    label: 'Name',
    documentation: 'Adds series name',
    origin: VariableOrigin.Series,
  },
];

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

  getDataLinkUIModel = <T>(link: DataLink, scopedVars: ScopedVars, origin: T) => {
    const params: KeyValue = {};
    const timeRangeUrl = toUrlParams(this.timeSrv.timeRangeForUrl());

    const info: LinkModel<T> = {
      href: link.url,
      title: this.templateSrv.replace(link.title || '', scopedVars),
      target: link.targetBlank ? '_blank' : '_self',
      origin,
    };

    this.templateSrv.fillVariableValuesForUrl(params, scopedVars);

    const variablesQuery = toUrlParams(params);
    info.href = this.templateSrv.replace(link.url, {
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
