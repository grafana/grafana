// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/metric_find_query.ts
import { map as _map } from 'lodash';

import { MetricFindValue, TimeRange } from '@grafana/data';

import { METRIC_LABEL } from './constants';
import { PrometheusDatasource } from './datasource';
import { getPrometheusTime } from './language_utils';
import {
  PrometheusLabelNamesRegex,
  PrometheusLabelNamesRegexWithMatch,
  PrometheusLabelValuesRegex,
  PrometheusMetricNamesRegex,
  PrometheusQueryResultRegex,
} from './migrations/variableMigration';
import { getOriginalMetricName } from './result_transformer';

export class PrometheusMetricFindQuery {
  constructor(
    private datasource: PrometheusDatasource,
    private query: string
  ) {
    this.datasource = datasource;
    this.query = query;
  }

  async process(timeRange: TimeRange): Promise<MetricFindValue[]> {
    const labelNamesRegex = PrometheusLabelNamesRegex;
    const labelNamesRegexWithMatch = PrometheusLabelNamesRegexWithMatch;
    const labelValuesRegex = PrometheusLabelValuesRegex;
    const metricNamesRegex = PrometheusMetricNamesRegex;
    const queryResultRegex = PrometheusQueryResultRegex;
    const labelNamesQuery = this.query.match(labelNamesRegex);
    const labelNamesMatchQuery = this.query.match(labelNamesRegexWithMatch);

    if (labelNamesMatchQuery) {
      const selector = `{__name__=~".*${labelNamesMatchQuery[1]}.*"}`;
      const keys = await this.datasource.languageProvider.queryLabelKeys(timeRange, selector);
      return keys.filter((key) => key !== METRIC_LABEL).map((result) => ({ text: result }));
    }

    if (labelNamesQuery) {
      return this.datasource.getTagKeys({ filters: [], timeRange });
    }

    const labelValuesQuery = this.query.match(labelValuesRegex);
    if (labelValuesQuery) {
      const filter = labelValuesQuery[1];
      const label = labelValuesQuery[2];
      if (isFilterDefined(filter)) {
        return await this.labelValuesQuery(label, timeRange, filter);
      } else {
        // Exclude the filter part of the expression because it is blank or empty
        return await this.labelValuesQuery(label, timeRange);
      }
    }

    const metricNamesQuery = this.query.match(metricNamesRegex);
    if (metricNamesQuery) {
      return await this.metricNameQuery(metricNamesQuery[1], timeRange);
    }

    const queryResultQuery = this.query.match(queryResultRegex);
    if (queryResultQuery) {
      return this.queryResultQuery(queryResultQuery[1], timeRange);
    }

    // if query contains full metric name, return metric name and label list
    const expressions = ['label_values()', 'metrics()', 'query_result()'];
    if (!expressions.includes(this.query)) {
      return await this.metricNameAndLabelsQuery(this.query, timeRange);
    }

    return Promise.resolve([]);
  }

  async labelValuesQuery(label: string, range: TimeRange, metric?: string) {
    const values = await this.datasource.languageProvider.queryLabelValues(range, label, metric);
    return values.map((value) => ({ text: value }));
  }

  async metricNameQuery(metricFilterPattern: string, range: TimeRange) {
    const names = await this.datasource.languageProvider.queryLabelValues(
      range,
      METRIC_LABEL,
      `{__name__=~"${metricFilterPattern}"}`
    );
    return names.map((n) => ({ text: n, expandable: true }));
  }

  queryResultQuery(query: string, range: TimeRange) {
    const url = '/api/v1/query';
    const params = {
      query,
      time: getPrometheusTime(range.to, true).toString(),
    };
    return this.datasource.metadataRequest(url, params).then((result) => {
      switch (result.data.data.resultType) {
        case 'scalar': // [ <unix_time>, "<scalar_value>" ]
        case 'string': // [ <unix_time>, "<string_value>" ]
          return [
            {
              text: result.data.data.result[1] || '',
              expandable: false,
            },
          ];
        case 'vector':
          return _map(result.data.data.result, (metricData) => {
            let text = metricData.metric.__name__ || '';
            delete metricData.metric.__name__;
            text +=
              '{' +
              _map(metricData.metric, (v, k) => {
                return k + '="' + v + '"';
              }).join(',') +
              '}';
            text += ' ' + metricData.value[1] + ' ' + metricData.value[0] * 1000;

            return {
              text: text,
              expandable: true,
            };
          });
        default:
          throw Error(`Unknown/Unhandled result type: [${result.data.data.resultType}]`);
      }
    });
  }

  async metricNameAndLabelsQuery(query: string, range: TimeRange): Promise<MetricFindValue[]> {
    const start = getPrometheusTime(range.from, false);
    const end = getPrometheusTime(range.to, true);
    const params = {
      'match[]': query,
      start: start.toString(),
      end: end.toString(),
    };

    const result = await this.datasource.metadataRequest(`/api/v1/series`, params);
    return result.data.data.map((metric: Record<string, string>) => ({
      text: getOriginalMetricName(metric),
      expandable: true,
    }));
  }
}

function isFilterDefined(filter: string) {
  // We consider blank strings or the empty filter {} as an undefined filter
  return filter && filter.split(' ').join('') !== '{}';
}
