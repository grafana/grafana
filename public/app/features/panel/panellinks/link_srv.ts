import _ from 'lodash';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { TemplateSrv } from 'app/features/templating/template_srv';
import coreModule from 'app/core/core_module';
import { appendQueryToUrl, toUrlParams } from 'app/core/utils/url';
import { PanelDrillDownLink, KeyValue, ScopedVars, DateTime, dateTime } from '@grafana/ui';
import { TimeSeriesValue, transformAbsoluteTimeRange } from '@grafana/ui';

const DrilldownLinkBuiltInVars = {
  keepTime: '__urlTimeRange',
  includeVars: '__allVariables',
  seriesName: '__seriesName',
  dataPointTs: '__dataPointTs',
};

// Represents factor by which the original time range will be narrowed down when
// using drilldown link
const DrilldownLinkDataPointRangeFactor = 0.5;

type LinkTarget = '_blank' | '_self';

interface LinkModel {
  url: string;
  title: string;
  target: LinkTarget;
}

interface LinkDataPoint {
  datapoint: TimeSeriesValue[];
  seriesLabel: string;
}
export interface LinkService {
  getDrilldownLinkUIModel: (link: PanelDrillDownLink, scopedVars: ScopedVars, dataPoint?: LinkDataPoint) => LinkModel;
  getDataPointVars: (seriesName: string, dataPointTs: DateTime) => ScopedVars;
}

export class LinkSrv implements LinkService {
  /** @ngInject */
  constructor(private templateSrv: TemplateSrv, private timeSrv: TimeSrv) {}

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

  getDataPointVars = (seriesName: string, dataPointTs: DateTime) => {
    const timeRange = this.timeSrv.timeRange();
    const targetAbsoluteTimeRange = transformAbsoluteTimeRange(timeRange, DrilldownLinkDataPointRangeFactor);
    const dataPointRangeQuery = toUrlParams({
      from: dateTime(dataPointTs)
        .subtract(targetAbsoluteTimeRange)
        .valueOf(),
      to: dateTime(dataPointTs)
        .add(targetAbsoluteTimeRange)
        .valueOf(),
    });

    const seriesQuery = toUrlParams({
      series: seriesName,
    });

    return {
      [DrilldownLinkBuiltInVars.dataPointTs]: {
        text: dataPointRangeQuery,
        value: dataPointRangeQuery,
      },
      [DrilldownLinkBuiltInVars.seriesName]: {
        text: seriesQuery,
        value: seriesQuery,
      },
    };
  };

  getDrilldownLinkUIModel = (link: PanelDrillDownLink, scopedVars: ScopedVars, dataPoint?: LinkDataPoint) => {
    const params: KeyValue = {};
    const timeRangeUrl = toUrlParams(this.timeSrv.timeRangeForUrl());
    const info: LinkModel = {
      url: link.url,
      title: this.templateSrv.replace(link.title || '', scopedVars),
      target: link.targetBlank ? '_blank' : '_self',
    };
    this.templateSrv.fillVariableValuesForUrl(params, scopedVars);

    const variablesQuery = toUrlParams(params);

    info.url = this.templateSrv.replace(link.url, {
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

    return dataPoint
      ? {
          ...info,
          url: this.templateSrv.replace(info.url, this.getDataPointVars(dataPoint.seriesLabel, dateTime(dataPoint[0]))),
        }
      : info;
  };
}

let singleton: LinkService;

export function setLinkSrv(srv: LinkService) {
  singleton = srv;
}

export function getLinkSrv(): LinkService {
  return singleton;
}

coreModule.service('linkSrv', LinkSrv);
