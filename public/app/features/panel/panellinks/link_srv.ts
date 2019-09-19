import _ from 'lodash';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import templateSrv, { TemplateSrv } from 'app/features/templating/template_srv';
import coreModule from 'app/core/core_module';
import { appendQueryToUrl, toUrlParams } from 'app/core/utils/url';
import { VariableSuggestion, VariableOrigin, DataLinkBuiltInVars } from '@grafana/ui';
import { DataLink, KeyValue, deprecationWarning, LinkModel, DataFrame, ScopedVars } from '@grafana/data';

const timeRangeVars = [
  {
    value: `${DataLinkBuiltInVars.keepTime}`,
    label: 'Time range',
    documentation: 'Adds current time range',
    origin: VariableOrigin.BuiltIn,
  },
  {
    value: `${DataLinkBuiltInVars.timeRangeFrom}`,
    label: 'Time range: from',
    documentation: "Adds current time range's from value",
    origin: VariableOrigin.BuiltIn,
  },
  {
    value: `${DataLinkBuiltInVars.timeRangeTo}`,
    label: 'Time range: to',
    documentation: "Adds current time range's to value",
    origin: VariableOrigin.BuiltIn,
  },
];

const fieldVars = [
  {
    value: `${DataLinkBuiltInVars.fieldName}`,
    label: 'Name',
    documentation: 'Field name of the clicked datapoint (in ms epoch)',
    origin: VariableOrigin.Field,
  },
];

const valueVars = [
  {
    value: `${DataLinkBuiltInVars.valueNumeric}`,
    label: 'Numeric',
    documentation: 'Numeric representation of selected value',
    origin: VariableOrigin.Value,
  },
  {
    value: `${DataLinkBuiltInVars.valueText}`,
    label: 'Text',
    documentation: 'Text representation of selected value',
    origin: VariableOrigin.Value,
  },
  {
    value: `${DataLinkBuiltInVars.valueRaw}`,
    label: 'Raw',
    documentation: 'Raw value',
    origin: VariableOrigin.Value,
  },
];

const buildLabelPath = (label: string) => {
  return label.indexOf('.') > -1 ? `["${label}"]` : `.${label}`;
};

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
  ...timeRangeVars,
];

const getSeriesVars = (dataFrames: DataFrame[]) => {
  const labels = _.flatten(dataFrames.map(df => Object.keys(df.labels || {})));

  return [
    {
      value: `${DataLinkBuiltInVars.seriesName}`,
      label: 'Name',
      documentation: 'Name of the series',
      origin: VariableOrigin.Series,
    },
    ...labels.map(label => ({
      value: `__series.labels${buildLabelPath(label)}`,
      label: `labels.${label}`,
      documentation: `${label} label value`,
      origin: VariableOrigin.Series,
    })),
  ];
};
export const getDataLinksVariableSuggestions = (dataFrames: DataFrame[]): VariableSuggestion[] => {
  const seriesVars = getSeriesVars(dataFrames);
  const valueTimeVar = {
    value: `${DataLinkBuiltInVars.valueTime}`,
    label: 'Time',
    documentation: 'Time value of the clicked datapoint (in ms epoch)',
    origin: VariableOrigin.Value,
  };

  return [...seriesVars, ...fieldVars, ...valueVars, valueTimeVar, ...getPanelLinksVariableSuggestions()];
};

export const getCalculationValueDataLinksVariableSuggestions = (dataFrames: DataFrame[]): VariableSuggestion[] => {
  const seriesVars = getSeriesVars(dataFrames);
  const valueCalcVar = {
    value: `${DataLinkBuiltInVars.valueCalc}`,
    label: 'Calculation name',
    documentation: 'Name of the calculation the value is a result of',
    origin: VariableOrigin.Value,
  };
  return [...seriesVars, ...fieldVars, ...valueVars, valueCalcVar, ...getPanelLinksVariableSuggestions()];
};

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
      href: link.url.replace(/\s|\n/g, ''),
      title: this.templateSrv.replace(link.title || '', scopedVars),
      target: link.targetBlank ? '_blank' : '_self',
      origin,
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
