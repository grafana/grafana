import _ from 'lodash';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import templateSrv, { TemplateSrv } from 'app/features/templating/template_srv';
import coreModule from 'app/core/core_module';
import { appendQueryToUrl, toUrlParams } from 'app/core/utils/url';
import { DataLink, VariableSuggestion, KeyValue, ScopedVars, DateTime, dateTime } from '@grafana/ui';
import { TimeSeriesValue } from '@grafana/ui';
import { deprecationWarning, VariableOrigin } from '@grafana/ui';

export const DataLinkBuiltInVars = {
  keepTime: '__url_time_range',
  includeVars: '__all_variables',
  seriesName: '__series_name',
  valueTime: '__value_time',
};

export const getPanelLinksVariableSuggestions = (): VariableSuggestion[] => [
  ...templateSrv.variables.map(variable => ({
    value: variable.name as string,
    origin: VariableOrigin.Template,
  })),
  {
    value: `${DataLinkBuiltInVars.includeVars}`,
    documentation: 'Adds current variables',
    origin: VariableOrigin.BuiltIn,
  },
  {
    value: `${DataLinkBuiltInVars.keepTime}`,
    documentation: 'Adds current time range',
    origin: VariableOrigin.BuiltIn,
  },
];

export const getDataLinksVariableSuggestions = (): VariableSuggestion[] => [
  ...getPanelLinksVariableSuggestions(),
  {
    value: `${DataLinkBuiltInVars.seriesName}`,
    documentation: 'Adds series name',
    origin: VariableOrigin.BuiltIn,
  },
  {
    value: `${DataLinkBuiltInVars.valueTime}`,
    documentation: "Adds narrowed down time range relative to data point's timestamp",
    origin: VariableOrigin.BuiltIn,
  },
];

type LinkTarget = '_blank' | '_self';

interface LinkModel {
  href: string;
  title: string;
  target: LinkTarget;
}

interface LinkDataPoint {
  datapoint: TimeSeriesValue[];
  seriesName: string;
}
export interface LinkService {
  getDataLinkUIModel: (link: DataLink, scopedVars: ScopedVars, dataPoint?: LinkDataPoint) => LinkModel;
  getDataPointVars: (seriesName: string, dataPointTs: DateTime) => ScopedVars;
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

  getDataPointVars = (seriesName: string, valueTime: DateTime) => {
    // const valueTimeQuery = toUrlParams({
    //   time: dateTime(valueTime).valueOf(),
    // });

    const seriesQuery = toUrlParams({
      series: seriesName,
    });

    return {
      [DataLinkBuiltInVars.valueTime]: {
        text: valueTime.valueOf(),
        value: valueTime.valueOf(),
      },
      [DataLinkBuiltInVars.seriesName]: {
        text: seriesQuery,
        value: seriesQuery,
      },
    };
  };

  getDataLinkUIModel = (link: DataLink, scopedVars: ScopedVars, dataPoint?: LinkDataPoint) => {
    const params: KeyValue = {};
    const timeRangeUrl = toUrlParams(this.timeSrv.timeRangeForUrl());

    const info: LinkModel = {
      href: link.url,
      title: this.templateSrv.replace(link.title || '', scopedVars),
      target: link.targetBlank ? '_blank' : '_self',
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

    if (dataPoint) {
      info.href = this.templateSrv.replace(
        info.href,
        this.getDataPointVars(dataPoint.seriesName, dateTime(dataPoint[0]))
      );
    }

    return info;
  };

  /**
   * getPanelLinkAnchorInfo method is left for plugins compatibility reasons
   *
   * @deprecated Drilldown links should be generated using getDataLinkUIModel method
   */
  getPanelLinkAnchorInfo(link: DataLink, scopedVars: ScopedVars) {
    deprecationWarning('link_srv.ts', 'getPanelLinkAnchorInfo', 'getDataLinkUIModel');
    return this.getDataLinkUIModel(link, scopedVars);
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
