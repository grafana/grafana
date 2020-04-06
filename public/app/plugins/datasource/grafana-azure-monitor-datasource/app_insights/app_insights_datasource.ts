import { TimeSeries, toDataFrame } from '@grafana/data';
import { DataQueryRequest, DataQueryResponseData, DataSourceInstanceSettings } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { TemplateSrv } from 'app/features/templating/template_srv';
import _ from 'lodash';

import TimegrainConverter from '../time_grain_converter';
import { AzureDataSourceJsonData, AzureMonitorQuery } from '../types';
import ResponseParser from './response_parser';

export interface LogAnalyticsColumn {
  text: string;
  value: string;
}
export default class AppInsightsDatasource {
  id: number;
  url: string;
  baseUrl: string;
  version = 'beta';
  applicationId: string;
  logAnalyticsColumns: { [key: string]: LogAnalyticsColumn[] } = {};

  /** @ngInject */
  constructor(instanceSettings: DataSourceInstanceSettings<AzureDataSourceJsonData>, private templateSrv: TemplateSrv) {
    this.id = instanceSettings.id;
    this.applicationId = instanceSettings.jsonData.appInsightsAppId;

    switch (instanceSettings.jsonData.cloudName) {
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

    this.url = instanceSettings.url;
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
        rawQueryString: this.templateSrv.replace(item.rawQueryString, options.scopedVars),
        timeColumn: item.timeColumn,
        valueColumn: item.valueColumn,
        segmentColumn: item.segmentColumn,
      },
    };
  }

  createMetricsRequest(item: any, options: DataQueryRequest<AzureMonitorQuery>, target: AzureMonitorQuery) {
    // fix for timeGrainUnit which is a deprecated/removed field name
    if (item.timeGrainCount) {
      item.timeGrain = TimegrainConverter.createISO8601Duration(item.timeGrainCount, item.timeGrainUnit);
    } else if (item.timeGrainUnit && item.timeGrain !== 'auto') {
      item.timeGrain = TimegrainConverter.createISO8601Duration(item.timeGrain, item.timeGrainUnit);
    }

    // migration for non-standard names
    if (item.groupBy && !item.dimension) {
      item.dimension = item.groupBy;
    }

    if (item.filter && !item.dimensionFilter) {
      item.dimensionFilter = item.filter;
    }

    return {
      type: 'timeSeriesQuery',
      raw: false,
      appInsights: {
        rawQuery: false,
        timeGrain: this.templateSrv.replace((item.timeGrain || '').toString(), options.scopedVars),
        allowedTimeGrainsMs: item.allowedTimeGrainsMs,
        metricName: this.templateSrv.replace(item.metricName, options.scopedVars),
        aggregation: this.templateSrv.replace(item.aggregation, options.scopedVars),
        dimension: this.templateSrv.replace(item.dimension, options.scopedVars),
        dimensionFilter: this.templateSrv.replace(item.dimensionFilter, options.scopedVars),
        alias: item.alias,
        format: target.format,
      },
    };
  }

  async query(options: DataQueryRequest<AzureMonitorQuery>): Promise<DataQueryResponseData[]> {
    const queries = _.filter(options.targets, item => {
      return item.hide !== true;
    }).map((target: AzureMonitorQuery) => {
      const item = target.appInsights;
      let query: any;
      if (item.rawQuery) {
        query = this.createRawQueryRequest(item, options, target);
      } else {
        query = this.createMetricsRequest(item, options, target);
      }
      query.refId = target.refId;
      query.intervalMs = options.intervalMs;
      query.datasourceId = this.id;
      query.queryType = 'Application Insights';
      return query;
    });

    if (!queries || queries.length === 0) {
      // @ts-ignore
      return;
    }

    const { data } = await getBackendSrv().datasourceRequest({
      url: '/api/tsdb/query',
      method: 'POST',
      data: {
        from: options.range.from.valueOf().toString(),
        to: options.range.to.valueOf().toString(),
        queries,
      },
    });

    const result: DataQueryResponseData[] = [];
    if (data.results) {
      Object.values(data.results).forEach((queryRes: any) => {
        if (queryRes.meta && queryRes.meta.columns) {
          const columnNames = queryRes.meta.columns as string[];
          this.logAnalyticsColumns[queryRes.refId] = _.map(columnNames, n => ({ text: n, value: n }));
        }

        if (!queryRes.series) {
          return;
        }

        queryRes.series.forEach((series: any) => {
          const timeSerie: TimeSeries = {
            target: series.name,
            datapoints: series.points,
            refId: queryRes.refId,
            meta: queryRes.meta,
          };
          result.push(toDataFrame(timeSerie));
        });
      });
      return result;
    }

    return Promise.resolve([]);
  }

  doQueries(queries: any) {
    return _.map(queries, query => {
      return this.doRequest(query.url)
        .then((result: any) => {
          return {
            result: result,
            query: query,
          };
        })
        .catch((err: any) => {
          throw {
            error: err,
            query: query,
          };
        });
    });
  }

  annotationQuery(options: any) {}

  metricFindQuery(query: string) {
    const appInsightsMetricNameQuery = query.match(/^AppInsightsMetricNames\(\)/i);
    if (appInsightsMetricNameQuery) {
      return this.getMetricNames();
    }

    const appInsightsGroupByQuery = query.match(/^AppInsightsGroupBys\(([^\)]+?)(,\s?([^,]+?))?\)/i);
    if (appInsightsGroupByQuery) {
      const metricName = appInsightsGroupByQuery[1];
      return this.getGroupBys(this.templateSrv.replace(metricName));
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
          message: 'Returned http status code ' + response.status,
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
