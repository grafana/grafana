import _ from 'lodash';
import AppInsightsQuerystringBuilder from './app_insights_querystring_builder';
import LogAnalyticsQuerystringBuilder from '../log_analytics/querystring_builder';
import ResponseParser from './response_parser';
import { DataSourceInstanceSettings } from '@grafana/ui';
import { AzureDataSourceJsonData } from '../types';
import { BackendSrv } from 'app/core/services/backend_srv';
import { TemplateSrv } from 'app/features/templating/template_srv';

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
  constructor(
    instanceSettings: DataSourceInstanceSettings<AzureDataSourceJsonData>,
    private backendSrv: BackendSrv,
    private templateSrv: TemplateSrv,
    private $q
  ) {
    this.id = instanceSettings.id;
    this.applicationId = instanceSettings.jsonData.appInsightsAppId;
    this.baseUrl = `/appinsights/${this.version}/apps/${this.applicationId}`;
    this.url = instanceSettings.url;
  }

  isConfigured(): boolean {
    return !!this.applicationId && this.applicationId.length > 0;
  }

  query(options) {
    const queries = _.filter(options.targets, item => {
      return item.hide !== true;
    }).map(target => {
      const item = target.appInsights;
      if (item.rawQuery) {
        const querystringBuilder = new LogAnalyticsQuerystringBuilder(
          this.templateSrv.replace(item.rawQueryString, options.scopedVars),
          options,
          'timestamp'
        );
        const generated = querystringBuilder.generate();

        const url = `${this.baseUrl}/query?${generated.uriString}`;

        return {
          refId: target.refId,
          intervalMs: options.intervalMs,
          maxDataPoints: options.maxDataPoints,
          datasourceId: this.id,
          url: url,
          format: options.format,
          alias: item.alias,
          query: generated.rawQuery,
          xaxis: item.xaxis,
          yaxis: item.yaxis,
          spliton: item.spliton,
          raw: true,
        };
      } else {
        const querystringBuilder = new AppInsightsQuerystringBuilder(
          options.range.from,
          options.range.to,
          options.interval
        );

        if (item.groupBy !== 'none') {
          querystringBuilder.setGroupBy(this.templateSrv.replace(item.groupBy, options.scopedVars));
        }
        querystringBuilder.setAggregation(item.aggregation);
        querystringBuilder.setInterval(
          item.timeGrainType,
          this.templateSrv.replace(item.timeGrain, options.scopedVars),
          item.timeGrainUnit
        );

        querystringBuilder.setFilter(this.templateSrv.replace(item.filter || ''));

        const url = `${this.baseUrl}/metrics/${this.templateSrv.replace(
          encodeURI(item.metricName),
          options.scopedVars
        )}?${querystringBuilder.generate()}`;

        return {
          refId: target.refId,
          intervalMs: options.intervalMs,
          maxDataPoints: options.maxDataPoints,
          datasourceId: this.id,
          url: url,
          format: options.format,
          alias: item.alias,
          xaxis: '',
          yaxis: '',
          spliton: '',
          raw: false,
        };
      }
    });

    if (!queries || queries.length === 0) {
      return;
    }

    const promises = this.doQueries(queries);

    return this.$q
      .all(promises)
      .then(results => {
        return new ResponseParser(results).parseQueryResult();
      })
      .then(results => {
        const flattened: any[] = [];

        for (let i = 0; i < results.length; i++) {
          if (results[i].columnsForDropdown) {
            this.logAnalyticsColumns[results[i].refId] = results[i].columnsForDropdown;
          }
          flattened.push(results[i]);
        }

        return flattened;
      });
  }

  doQueries(queries) {
    return _.map(queries, query => {
      return this.doRequest(query.url)
        .then(result => {
          return {
            result: result,
            query: query,
          };
        })
        .catch(err => {
          throw {
            error: err,
            query: query,
          };
        });
    });
  }

  annotationQuery(options) {}

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
      .then(response => {
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
      .catch(error => {
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

  doRequest(url, maxRetries = 1) {
    return this.backendSrv
      .datasourceRequest({
        url: this.url + url,
        method: 'GET',
      })
      .catch(error => {
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
    return this.doRequest(url).then(result => {
      return new ResponseParser(result).parseMetadata(metricName);
    });
  }

  getGroupBys(metricName: string) {
    return this.getMetricMetadata(metricName).then(result => {
      return new ResponseParser(result).parseGroupBys();
    });
  }

  getQuerySchema() {
    const url = `${this.baseUrl}/query/schema`;
    return this.doRequest(url).then(result => {
      const schema = new ResponseParser(result).parseQuerySchema();
      // console.log(schema);
      return schema;
    });
  }
}
