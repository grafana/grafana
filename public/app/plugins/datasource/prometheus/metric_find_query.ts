import { chain, map as _map, uniq } from 'lodash';
import { lastValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';

import { MetricFindValue, TimeRange } from '@grafana/data';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';

import { PrometheusDatasource } from './datasource';
import { PromQueryRequest } from './types';

export default class PrometheusMetricFindQuery {
  range: TimeRange;

  constructor(private datasource: PrometheusDatasource, private query: string) {
    this.datasource = datasource;
    this.query = query;
    this.range = getTimeSrv().timeRange();
  }

  process(): Promise<MetricFindValue[]> {
    const labelNamesRegex = /^label_names\(\)\s*$/;
    const labelValuesRegex = /^label_values\((?:(.+),\s*)?([a-zA-Z_][a-zA-Z0-9_]*)\)\s*$/;
    const metricNamesRegex = /^metrics\((.+)\)\s*$/;
    const queryResultRegex = /^query_result\((.+)\)\s*$/;
    const labelNamesQuery = this.query.match(labelNamesRegex);
    if (labelNamesQuery) {
      return this.labelNamesQuery();
    }

    const labelValuesQuery = this.query.match(labelValuesRegex);
    if (labelValuesQuery) {
      if (labelValuesQuery[1]) {
        return this.labelValuesQuery(labelValuesQuery[2], labelValuesQuery[1]);
      } else {
        return this.labelValuesQuery(labelValuesQuery[2]);
      }
    }

    const metricNamesQuery = this.query.match(metricNamesRegex);
    if (metricNamesQuery) {
      return this.metricNameQuery(metricNamesQuery[1]);
    }

    const queryResultQuery = this.query.match(queryResultRegex);
    if (queryResultQuery) {
      return lastValueFrom(this.queryResultQuery(queryResultQuery[1]));
    }

    // if query contains full metric name, return metric name and label list
    return this.metricNameAndLabelsQuery(this.query);
  }

  labelNamesQuery() {
    const start = this.datasource.getPrometheusTime(this.range.from, false);
    const end = this.datasource.getPrometheusTime(this.range.to, true);
    const params = {
      start: start.toString(),
      end: end.toString(),
    };

    const url = `/api/v1/labels`;

    return this.datasource.metadataRequest(url, params).then((result: any) => {
      return _map(result.data.data, (value) => {
        return { text: value };
      });
    });
  }

  labelValuesQuery(label: string, metric?: string) {
    const start = this.datasource.getPrometheusTime(this.range.from, false);
    const end = this.datasource.getPrometheusTime(this.range.to, true);
    const params = { ...(metric && { 'match[]': metric }), start: start.toString(), end: end.toString() };

    if (!metric || this.datasource.hasLabelsMatchAPISupport()) {
      const url = `/api/v1/label/${label}/values`;

      return this.datasource.metadataRequest(url, params).then((result: any) => {
        return _map(result.data.data, (value) => {
          return { text: value };
        });
      });
    } else {
      const url = `/api/v1/series`;

      return this.datasource.metadataRequest(url, params).then((result: any) => {
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
    const start = this.datasource.getPrometheusTime(this.range.from, false);
    const end = this.datasource.getPrometheusTime(this.range.to, true);
    const params = {
      start: start.toString(),
      end: end.toString(),
    };
    const url = `/api/v1/label/__name__/values`;

    return this.datasource.metadataRequest(url, params).then((result: any) => {
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
    const end = this.datasource.getPrometheusTime(this.range.to, true);
    const instantQuery: PromQueryRequest = { expr: query } as PromQueryRequest;
    return this.datasource.performInstantQuery(instantQuery, end).pipe(
      map((result) => {
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
      })
    );
  }

  metricNameAndLabelsQuery(query: string): Promise<MetricFindValue[]> {
    const start = this.datasource.getPrometheusTime(this.range.from, false);
    const end = this.datasource.getPrometheusTime(this.range.to, true);
    const params = {
      'match[]': query,
      start: start.toString(),
      end: end.toString(),
    };

    const url = `/api/v1/series`;
    const self = this;

    return this.datasource.metadataRequest(url, params).then((result: any) => {
      return _map(result.data.data, (metric: { [key: string]: string }) => {
        return {
          text: self.datasource.getOriginalMetricName(metric),
          expandable: true,
        };
      });
    });
  }
}
