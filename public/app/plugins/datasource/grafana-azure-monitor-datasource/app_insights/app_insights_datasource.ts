import { ScopedVars } from '@grafana/data';
import { DataQueryRequest, DataSourceInstanceSettings } from '@grafana/data';
import { getBackendSrv, getTemplateSrv, DataSourceWithBackend } from '@grafana/runtime';
import _, { isString } from 'lodash';

import TimegrainConverter from '../time_grain_converter';
import { AzureDataSourceJsonData, AzureMonitorQuery, AzureQueryType } from '../types';
import ResponseParser from './response_parser';

export interface LogAnalyticsColumn {
  text: string;
  value: string;
}
export default class AppInsightsDatasource extends DataSourceWithBackend<AzureMonitorQuery, AzureDataSourceJsonData> {
  url: string;
  baseUrl: string;
  version = 'beta';
  applicationId: string;
  logAnalyticsColumns: { [key: string]: LogAnalyticsColumn[] } = {};

  constructor(instanceSettings: DataSourceInstanceSettings<AzureDataSourceJsonData>) {
    super(instanceSettings);
    this.applicationId = instanceSettings.jsonData.appInsightsAppId || '';

    switch (instanceSettings.jsonData?.cloudName) {
      // Azure US Government
      case 'govazuremonitor':
        break;
      // Azure Germany
      case 'germanyazuremonitor':
        break;
      // Azue China
      case 'chinaazuremonitor':
        this.baseUrl = `/chinaappinsights/${this.version}/apps/${this.applicationId}`;
        break;
      // Azure Global
      default:
        this.baseUrl = `/appinsights/${this.version}/apps/${this.applicationId}`;
    }

    this.url = instanceSettings.url || '';
  }

  isConfigured(): boolean {
    return !!this.applicationId && this.applicationId.length > 0;
  }

  createRawQueryRequest(item: any, options: DataQueryRequest<AzureMonitorQuery>, target: AzureMonitorQuery) {
    if (item.xaxis && !item.timeColumn) {
      item.timeColumn = item.xaxis;
    }

    if (item.yaxis && !item.valueColumn) {
      item.valueColumn = item.yaxis;
    }

    if (item.spliton && !item.segmentColumn) {
      item.segmentColumn = item.spliton;
    }

    return {
      type: 'timeSeriesQuery',
      raw: false,
      appInsights: {
        rawQuery: true,
        rawQueryString: getTemplateSrv().replace(item.rawQueryString, options.scopedVars),
        timeColumn: item.timeColumn,
        valueColumn: item.valueColumn,
        segmentColumn: item.segmentColumn,
      },
    };
  }

  applyTemplateVariables(target: AzureMonitorQuery, scopedVars: ScopedVars): Record<string, any> {
    const item = target.appInsights;

    const old: any = item;
    // fix for timeGrainUnit which is a deprecated/removed field name
    if (old.timeGrainCount) {
      item.timeGrain = TimegrainConverter.createISO8601Duration(old.timeGrainCount, item.timeGrainUnit);
    } else if (item.timeGrainUnit && item.timeGrain !== 'auto') {
      item.timeGrain = TimegrainConverter.createISO8601Duration(item.timeGrain, item.timeGrainUnit);
    }

    // migration for non-standard names
    if (old.groupBy && !item.dimension) {
      item.dimension = [old.groupBy];
    }
    if (old.filter && !item.dimensionFilter) {
      item.dimensionFilter = old.filter;
    }

    // Migrate single dimension string to array
    if (isString(item.dimension)) {
      if (item.dimension === 'None') {
        item.dimension = [];
      } else {
        item.dimension = [item.dimension as string];
      }
    }
    if (!item.dimension) {
      item.dimension = [];
    }

    const templateSrv = getTemplateSrv();

    return {
      type: 'timeSeriesQuery',
      refId: target.refId,
      format: target.format,
      queryType: AzureQueryType.ApplicationInsights,
      appInsights: {
        timeGrain: templateSrv.replace((item.timeGrain || '').toString(), scopedVars),
        allowedTimeGrainsMs: item.allowedTimeGrainsMs,
        metricName: templateSrv.replace(item.metricName, scopedVars),
        aggregation: templateSrv.replace(item.aggregation, scopedVars),
        dimension: item.dimension.map(d => templateSrv.replace(d, scopedVars)),
        dimensionFilter: templateSrv.replace(item.dimensionFilter, scopedVars),
        alias: item.alias,
        format: target.format,
      },
    };
  }

  metricFindQuery(query: string) {
    const appInsightsMetricNameQuery = query.match(/^AppInsightsMetricNames\(\)/i);
    if (appInsightsMetricNameQuery) {
      return this.getMetricNames();
    }

    const appInsightsGroupByQuery = query.match(/^AppInsightsGroupBys\(([^\)]+?)(,\s?([^,]+?))?\)/i);
    if (appInsightsGroupByQuery) {
      const metricName = appInsightsGroupByQuery[1];
      return this.getGroupBys(getTemplateSrv().replace(metricName));
    }

    return undefined;
  }

  testDatasource() {
    const url = `${this.baseUrl}/metrics/metadata`;
    return this.doRequest(url)
      .then((response: any) => {
        if (response.status === 200) {
          return {
            status: 'success',
            message: 'Successfully queried the Application Insights service.',
            title: 'Success',
          };
        }

        return {
          status: 'error',
          message: 'Application Insights: Returned http status code ' + response.status,
        };
      })
      .catch((error: any) => {
        let message = 'Application Insights: ';
        message += error.statusText ? error.statusText + ': ' : '';

        if (error.data && error.data.error && error.data.error.code === 'PathNotFoundError') {
          message += 'Invalid Application Id for Application Insights service.';
        } else if (error.data && error.data.error) {
          message += error.data.error.code + '. ' + error.data.error.message;
        } else {
          message += 'Cannot connect to Application Insights REST API.';
        }

        return {
          status: 'error',
          message: message,
        };
      });
  }

  doRequest(url: any, maxRetries = 1): Promise<any> {
    return getBackendSrv()
      .datasourceRequest({
        url: this.url + url,
        method: 'GET',
      })
      .catch((error: any) => {
        if (maxRetries > 0) {
          return this.doRequest(url, maxRetries - 1);
        }

        throw error;
      });
  }

  getMetricNames() {
    const url = `${this.baseUrl}/metrics/metadata`;
    return this.doRequest(url).then(ResponseParser.parseMetricNames);
  }

  getMetricMetadata(metricName: string) {
    const url = `${this.baseUrl}/metrics/metadata`;
    return this.doRequest(url).then((result: any) => {
      return new ResponseParser(result).parseMetadata(metricName);
    });
  }

  getGroupBys(metricName: string) {
    return this.getMetricMetadata(metricName).then((result: any) => {
      return new ResponseParser(result).parseGroupBys();
    });
  }

  getQuerySchema() {
    const url = `${this.baseUrl}/query/schema`;
    return this.doRequest(url).then((result: any) => {
      const schema = new ResponseParser(result).parseQuerySchema();
      // console.log(schema);
      return schema;
    });
  }
}
