// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/metric_find_query.ts
import { chain, map as _map, uniq } from 'lodash';

import { getDefaultTimeRange, MetricFindValue, TimeRange } from '@grafana/data';

import { PrometheusDatasource } from './datasource';
import { getPrometheusTime } from './language_utils';
import {
  PrometheusLabelNamesRegex,
  PrometheusLabelNamesRegexWithMatch,
  PrometheusLabelValuesRegex,
  PrometheusMetricNamesRegex,
  PrometheusQueryResultRegex,
} from './migrations/variableMigration';
import { escapeForUtf8Support, isValidLegacyName } from './utf8_support';

export class PrometheusMetricFindQuery {
  range: TimeRange;

  constructor(
    private datasource: PrometheusDatasource,
    private query: string
  ) {
    this.datasource = datasource;
    this.query = query;
    this.range = getDefaultTimeRange();
  }

  process(timeRange: TimeRange): Promise<MetricFindValue[]> {
    this.range = timeRange;
    const labelNamesRegex = PrometheusLabelNamesRegex;
    const labelNamesRegexWithMatch = PrometheusLabelNamesRegexWithMatch;
    const labelValuesRegex = PrometheusLabelValuesRegex;
    const metricNamesRegex = PrometheusMetricNamesRegex;
    const queryResultRegex = PrometheusQueryResultRegex;
    const labelNamesQuery = this.query.match(labelNamesRegex);
    const labelNamesMatchQuery = this.query.match(labelNamesRegexWithMatch);

    if (labelNamesMatchQuery) {
      const selector = `{__name__=~".*${labelNamesMatchQuery[1]}.*"}`;
      return this.datasource.languageProvider.getSeriesLabels(selector, []).then((results) =>
        results.map((result) => ({
          text: result,
        }))
      );
    }

    if (labelNamesQuery) {
      return this.datasource.getTagKeys({ filters: [], timeRange });
    }

    const labelValuesQuery = this.query.match(labelValuesRegex);
    if (labelValuesQuery) {
      const filter = labelValuesQuery[1];
      const label = labelValuesQuery[2];
      if (isFilterDefined(filter)) {
        return this.labelValuesQuery(label, filter);
      } else {
        // Exclude the filter part of the expression because it is blank or empty
        return this.labelValuesQuery(label);
      }
    }

    const metricNamesQuery = this.query.match(metricNamesRegex);
    if (metricNamesQuery) {
      return this.metricNameQuery(metricNamesQuery[1]);
    }

    const queryResultQuery = this.query.match(queryResultRegex);
    if (queryResultQuery) {
      return this.queryResultQuery(queryResultQuery[1]);
    }

    // if query contains full metric name, return metric name and label list
    const expressions = ['label_values()', 'metrics()', 'query_result()'];
    if (!expressions.includes(this.query)) {
      return this.metricNameAndLabelsQuery(this.query);
    }

    return Promise.resolve([]);
  }

  labelValuesQuery(label: string, metric?: string) {
    const start = getPrometheusTime(this.range.from, false);
    const end = getPrometheusTime(this.range.to, true);
    const params = { ...(metric && { 'match[]': metric }), start: start.toString(), end: end.toString() };

    let escapedLabel = label;
    if (!isValidLegacyName(label)) {
      escapedLabel = escapeForUtf8Support(label);
    }

    if (!metric || this.datasource.hasLabelsMatchAPISupport()) {
      const url = `/api/v1/label/${escapedLabel}/values`;

      return this.datasource.metadataRequest(url, params).then((result) => {
        return _map(result.data.data, (value) => {
          return { text: value };
        });
      });
    } else {
      const url = `/api/v1/series`;

      return this.datasource.metadataRequest(url, params).then((result) => {
        const _labels = _map(result.data.data, (metric) => {
          return metric[label] || '';
        }).filter((label) => {
          return label !== '';
        });

        return uniq(_labels).map((metric) => {
          return {
            text: metric,
            expandable: true,
          };
        });
      });
    }
  }

  metricNameQuery(metricFilterPattern: string) {
    const start = getPrometheusTime(this.range.from, false);
    const end = getPrometheusTime(this.range.to, true);
    const params = {
      start: start.toString(),
      end: end.toString(),
    };
    const url = `/api/v1/label/__name__/values`;

    return this.datasource.metadataRequest(url, params).then((result) => {
      return chain(result.data.data)
        .filter((metricName) => {
          const r = new RegExp(metricFilterPattern);
          return r.test(metricName);
        })
        .map((matchedMetricName) => {
          return {
            text: matchedMetricName,
            expandable: true,
          };
        })
        .value();
    });
  }

  queryResultQuery(query: string) {
    const url = '/api/v1/query';
    const params = {
      query,
      time: getPrometheusTime(this.range.to, true).toString(),
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

  metricNameAndLabelsQuery(query: string): Promise<MetricFindValue[]> {
    const start = getPrometheusTime(this.range.from, false);
    const end = getPrometheusTime(this.range.to, true);
    const params = {
      'match[]': query,
      start: start.toString(),
      end: end.toString(),
    };

    const url = `/api/v1/series`;
    const self = this;

    return this.datasource.metadataRequest(url, params).then((result) => {
      return _map(result.data.data, (metric: { [key: string]: string }) => {
        return {
          text: self.datasource.getOriginalMetricName(metric),
          expandable: true,
        };
      });
    });
  }
}

function isFilterDefined(filter: string) {
  // We consider blank strings or the empty filter {} as an undefined filter
  return filter && filter.split(' ').join('') !== '{}';
}
