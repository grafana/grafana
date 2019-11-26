import React from 'react';
import angular, { IQService } from 'angular';
import _ from 'lodash';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { AppNotificationTimeout } from 'app/types';
import { store } from 'app/store/store';
import kbn from 'app/core/utils/kbn';
import {
  dateMath,
  ScopedVars,
  toDataFrame,
  TimeRange,
  DataSourceApi,
  DataQueryRequest,
  DataSourceInstanceSettings,
} from '@grafana/data';
import { BackendSrv } from 'app/core/services/backend_srv';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { ThrottlingErrorMessage } from './components/ThrottlingErrorMessage';
import memoizedDebounce from './memoizedDebounce';
import { CloudWatchQuery, CloudWatchJsonData } from './types';

const displayAlert = (datasourceName: string, region: string) =>
  store.dispatch(
    notifyApp(
      createErrorNotification(
        `CloudWatch request limit reached in ${region} for data source ${datasourceName}`,
        '',
        React.createElement(ThrottlingErrorMessage, { region }, null)
      )
    )
  );

const displayCustomError = (title: string, message: string) =>
  store.dispatch(notifyApp(createErrorNotification(title, message)));

export default class CloudWatchDatasource extends DataSourceApi<CloudWatchQuery, CloudWatchJsonData> {
  type: any;
  proxyUrl: any;
  defaultRegion: any;
  standardStatistics: any;
  datasourceName: string;
  debouncedAlert: (datasourceName: string, region: string) => void;
  debouncedCustomAlert: (title: string, message: string) => void;

  /** @ngInject */
  constructor(
    instanceSettings: DataSourceInstanceSettings<CloudWatchJsonData>,
    private $q: IQService,
    private backendSrv: BackendSrv,
    private templateSrv: TemplateSrv,
    private timeSrv: TimeSrv
  ) {
    super(instanceSettings);
    this.type = 'cloudwatch';
    this.proxyUrl = instanceSettings.url;
    this.defaultRegion = instanceSettings.jsonData.defaultRegion;
    this.datasourceName = instanceSettings.name;
    this.standardStatistics = ['Average', 'Maximum', 'Minimum', 'Sum', 'SampleCount'];
    this.debouncedAlert = memoizedDebounce(displayAlert, AppNotificationTimeout.Error);
    this.debouncedCustomAlert = memoizedDebounce(displayCustomError, AppNotificationTimeout.Error);
  }

  query(options: DataQueryRequest<CloudWatchQuery>) {
    options = angular.copy(options);

    const queries = _.filter(options.targets, item => {
      return (
        (item.id !== '' || item.hide !== true) &&
        ((!!item.region && !!item.namespace && !!item.metricName && !_.isEmpty(item.statistics)) ||
          item.expression.length > 0)
      );
    }).map(item => {
      item.region = this.replace(this.getActualRegion(item.region), options.scopedVars, true, 'region');
      item.namespace = this.replace(item.namespace, options.scopedVars, true, 'namespace');
      item.metricName = this.replace(item.metricName, options.scopedVars, true, 'metric name');
      item.dimensions = this.convertDimensionFormat(item.dimensions, options.scopedVars);
      item.statistics = item.statistics.map(stat => this.replace(stat, options.scopedVars, true, 'statistics'));
      item.period = String(this.getPeriod(item, options)); // use string format for period in graph query, and alerting
      item.id = this.replace(item.id, options.scopedVars, true, 'id');
      item.expression = this.replace(item.expression, options.scopedVars, true, 'expression');

      // valid ExtendedStatistics is like p90.00, check the pattern
      const hasInvalidStatistics = item.statistics.some(s => {
        if (s.indexOf('p') === 0) {
          const matches = /^p\d{2}(?:\.\d{1,2})?$/.exec(s);
          return !matches || matches[0] !== s;
        }

        return false;
      });

      if (hasInvalidStatistics) {
        throw { message: 'Invalid extended statistics' };
      }

      return _.extend(
        {
          refId: item.refId,
          intervalMs: options.intervalMs,
          maxDataPoints: options.maxDataPoints,
          datasourceId: this.id,
          type: 'timeSeriesQuery',
        },
        item
      );
    });

    // No valid targets, return the empty result to save a round trip.
    if (_.isEmpty(queries)) {
      const d = this.$q.defer();
      d.resolve({ data: [] });
      return d.promise;
    }

    const request = {
      from: options.range.from.valueOf().toString(),
      to: options.range.to.valueOf().toString(),
      queries: queries,
    };

    return this.performTimeSeriesQuery(request, options.range);
  }

  get variables() {
    return this.templateSrv.variables.map(v => `$${v.name}`);
  }

  getPeriod(target: any, options: any, now?: number) {
    const start = this.convertToCloudWatchTime(options.range.from, false);
    now = Math.round((now || Date.now()) / 1000);

    let period;
    const hourSec = 60 * 60;
    const daySec = hourSec * 24;
    if (!target.period) {
      if (now - start <= daySec * 15) {
        // until 15 days ago
        if (target.namespace === 'AWS/EC2') {
          period = 300;
        } else {
          period = 60;
        }
      } else if (now - start <= daySec * 63) {
        // until 63 days ago
        period = 60 * 5;
      } else if (now - start <= daySec * 455) {
        // until 455 days ago
        period = 60 * 60;
      } else {
        // over 455 days, should return error, but try to long period
        period = 60 * 60;
      }
    } else {
      period = this.templateSrv.replace(target.period, options.scopedVars);
      if (/^\d+$/.test(period)) {
        period = parseInt(period, 10);
      } else {
        period = kbn.interval_to_seconds(period);
      }
    }
    if (period < 1) {
      period = 1;
    }

    return period;
  }

  buildCloudwatchConsoleUrl(
    { region, namespace, metricName, dimensions, statistics, period, expression }: CloudWatchQuery,
    start: string,
    end: string,
    title: string,
    gmdMeta: Array<{ Expression: string }>
  ) {
    region = this.getActualRegion(region);
    let conf = {
      view: 'timeSeries',
      stacked: false,
      title,
      start,
      end,
      region,
    } as any;

    const isSearchExpression =
      gmdMeta && gmdMeta.length && gmdMeta.every(({ Expression: expression }) => /SEARCH().*/.test(expression));
    const isMathExpression = !isSearchExpression && expression;

    if (isMathExpression) {
      return '';
    }

    if (isSearchExpression) {
      const metrics: any =
        gmdMeta && gmdMeta.length ? gmdMeta.map(({ Expression: expression }) => ({ expression })) : [{ expression }];
      conf = { ...conf, metrics };
    } else {
      conf = {
        ...conf,
        metrics: [
          ...statistics.map(stat => [
            namespace,
            metricName,
            ...Object.entries(dimensions).reduce((acc, [key, value]) => [...acc, key, value[0]], []),
            {
              stat,
              period,
            },
          ]),
        ],
      };
    }

    return `https://${region}.console.aws.amazon.com/cloudwatch/deeplink.js?region=${region}#metricsV2:graph=${encodeURIComponent(
      JSON.stringify(conf)
    )}`;
  }

  performTimeSeriesQuery(request: any, { from, to }: TimeRange) {
    return this.awsRequest('/api/tsdb/query', request)
      .then((res: any) => {
        if (!res.results) {
          return { data: [] };
        }
        return Object.values(request.queries).reduce(
          ({ data, error }: any, queryRequest: any) => {
            const queryResult = res.results[queryRequest.refId];
            if (!queryResult) {
              return { data, error };
            }

            const link = this.buildCloudwatchConsoleUrl(
              queryRequest,
              from.toISOString(),
              to.toISOString(),
              queryRequest.refId,
              queryResult.meta.gmdMeta
            );

            return {
              error: error || queryResult.error ? { message: queryResult.error } : null,
              data: [
                ...data,
                ...queryResult.series.map(({ name, points }: any) => {
                  const dataFrame = toDataFrame({
                    target: name,
                    datapoints: points,
                    refId: queryRequest.refId,
                    meta: queryResult.meta,
                  });
                  if (link) {
                    for (const field of dataFrame.fields) {
                      field.config.links = [
                        {
                          url: link,
                          title: 'View in CloudWatch console',
                          targetBlank: true,
                        },
                      ];
                    }
                  }
                  return dataFrame;
                }),
              ],
            };
          },
          { data: [], error: null }
        );
      })
      .catch((err: any = { data: { error: '' } }) => {
        if (/^Throttling:.*/.test(err.data.message)) {
          const failedRedIds = Object.keys(err.data.results);
          const regionsAffected = Object.values(request.queries).reduce(
            (res: string[], { refId, region }: CloudWatchQuery) =>
              !failedRedIds.includes(refId) || res.includes(region) ? res : [...res, region],
            []
          ) as string[];

          regionsAffected.forEach(region => this.debouncedAlert(this.datasourceName, this.getActualRegion(region)));
        }

        if (err.data && err.data.message === 'Metric request error' && err.data.error) {
          err.data.message = err.data.error;
        }

        throw err;
      });
  }

  transformSuggestDataFromTable(suggestData: any) {
    return _.map(suggestData.results['metricFindQuery'].tables[0].rows, v => {
      return {
        text: v[0],
        value: v[1],
        label: v[1],
      };
    });
  }

  doMetricQueryRequest(subtype: any, parameters: any) {
    const range = this.timeSrv.timeRange();
    return this.awsRequest('/api/tsdb/query', {
      from: range.from.valueOf().toString(),
      to: range.to.valueOf().toString(),
      queries: [
        _.extend(
          {
            refId: 'metricFindQuery',
            intervalMs: 1, // dummy
            maxDataPoints: 1, // dummy
            datasourceId: this.id,
            type: 'metricFindQuery',
            subtype: subtype,
          },
          parameters
        ),
      ],
    }).then((r: any) => {
      return this.transformSuggestDataFromTable(r);
    });
  }

  getRegions() {
    return this.doMetricQueryRequest('regions', null).then((regions: any) => [
      { label: 'default', value: 'default', text: 'default' },
      ...regions,
    ]);
  }

  getNamespaces() {
    return this.doMetricQueryRequest('namespaces', null);
  }

  async getMetrics(namespace: string, region: string) {
    if (!namespace || !region) {
      return [];
    }

    return this.doMetricQueryRequest('metrics', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
    });
  }

  async getDimensionKeys(namespace: string, region: string) {
    if (!namespace) {
      return [];
    }

    return this.doMetricQueryRequest('dimension_keys', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
    });
  }

  async getDimensionValues(
    region: string,
    namespace: string,
    metricName: string,
    dimensionKey: string,
    filterDimensions: {}
  ) {
    if (!namespace || !metricName) {
      return [];
    }

    const values = await this.doMetricQueryRequest('dimension_values', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
      metricName: this.templateSrv.replace(metricName.trim()),
      dimensionKey: this.templateSrv.replace(dimensionKey),
      dimensions: this.convertDimensionFormat(filterDimensions, {}),
    });

    return values.length ? [{ value: '*', text: '*', label: '*' }, ...values] : values;
  }

  getEbsVolumeIds(region: string, instanceId: string) {
    return this.doMetricQueryRequest('ebs_volume_ids', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      instanceId: this.templateSrv.replace(instanceId),
    });
  }

  getEc2InstanceAttribute(region: string, attributeName: string, filters: any) {
    return this.doMetricQueryRequest('ec2_instance_attribute', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      attributeName: this.templateSrv.replace(attributeName),
      filters: filters,
    });
  }

  getResourceARNs(region: string, resourceType: string, tags: any) {
    return this.doMetricQueryRequest('resource_arns', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      resourceType: this.templateSrv.replace(resourceType),
      tags: tags,
    });
  }

  async metricFindQuery(query: string) {
    let region;
    let namespace;
    let metricName;
    let filterJson;

    const regionQuery = query.match(/^regions\(\)/);
    if (regionQuery) {
      return this.getRegions();
    }

    const namespaceQuery = query.match(/^namespaces\(\)/);
    if (namespaceQuery) {
      return this.getNamespaces();
    }

    const metricNameQuery = query.match(/^metrics\(([^\)]+?)(,\s?([^,]+?))?\)/);
    if (metricNameQuery) {
      namespace = metricNameQuery[1];
      region = metricNameQuery[3];
      return this.getMetrics(namespace, region);
    }

    const dimensionKeysQuery = query.match(/^dimension_keys\(([^\)]+?)(,\s?([^,]+?))?\)/);
    if (dimensionKeysQuery) {
      namespace = dimensionKeysQuery[1];
      region = dimensionKeysQuery[3];
      return this.getDimensionKeys(namespace, region);
    }

    const dimensionValuesQuery = query.match(
      /^dimension_values\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?)(,\s?(.+))?\)/
    );
    if (dimensionValuesQuery) {
      region = dimensionValuesQuery[1];
      namespace = dimensionValuesQuery[2];
      metricName = dimensionValuesQuery[3];
      const dimensionKey = dimensionValuesQuery[4];
      filterJson = {};
      if (dimensionValuesQuery[6]) {
        filterJson = JSON.parse(this.templateSrv.replace(dimensionValuesQuery[6]));
      }

      return this.getDimensionValues(region, namespace, metricName, dimensionKey, filterJson);
    }

    const ebsVolumeIdsQuery = query.match(/^ebs_volume_ids\(([^,]+?),\s?([^,]+?)\)/);
    if (ebsVolumeIdsQuery) {
      region = ebsVolumeIdsQuery[1];
      const instanceId = ebsVolumeIdsQuery[2];
      return this.getEbsVolumeIds(region, instanceId);
    }

    const ec2InstanceAttributeQuery = query.match(/^ec2_instance_attribute\(([^,]+?),\s?([^,]+?),\s?(.+?)\)/);
    if (ec2InstanceAttributeQuery) {
      region = ec2InstanceAttributeQuery[1];
      const targetAttributeName = ec2InstanceAttributeQuery[2];
      filterJson = JSON.parse(this.templateSrv.replace(ec2InstanceAttributeQuery[3]));
      return this.getEc2InstanceAttribute(region, targetAttributeName, filterJson);
    }

    const resourceARNsQuery = query.match(/^resource_arns\(([^,]+?),\s?([^,]+?),\s?(.+?)\)/);
    if (resourceARNsQuery) {
      region = resourceARNsQuery[1];
      const resourceType = resourceARNsQuery[2];
      const tagsJSON = JSON.parse(this.templateSrv.replace(resourceARNsQuery[3]));
      return this.getResourceARNs(region, resourceType, tagsJSON);
    }

    const statsQuery = query.match(/^statistics\(\)/);
    if (statsQuery) {
      return this.standardStatistics.map((s: string) => ({ value: s, label: s, text: s }));
    }

    return this.$q.when([]);
  }

  annotationQuery(options: any) {
    const annotation = options.annotation;
    const statistics = _.map(annotation.statistics, s => {
      return this.templateSrv.replace(s);
    });
    const defaultPeriod = annotation.prefixMatching ? '' : '300';
    let period = annotation.period || defaultPeriod;
    period = parseInt(period, 10);
    const parameters = {
      prefixMatching: annotation.prefixMatching,
      region: this.templateSrv.replace(this.getActualRegion(annotation.region)),
      namespace: this.templateSrv.replace(annotation.namespace),
      metricName: this.templateSrv.replace(annotation.metricName),
      dimensions: this.convertDimensionFormat(annotation.dimensions, {}),
      statistics: statistics,
      period: period,
      actionPrefix: annotation.actionPrefix || '',
      alarmNamePrefix: annotation.alarmNamePrefix || '',
    };

    return this.awsRequest('/api/tsdb/query', {
      from: options.range.from.valueOf().toString(),
      to: options.range.to.valueOf().toString(),
      queries: [
        _.extend(
          {
            refId: 'annotationQuery',
            intervalMs: 1, // dummy
            maxDataPoints: 1, // dummy
            datasourceId: this.id,
            type: 'annotationQuery',
          },
          parameters
        ),
      ],
    }).then((r: any) => {
      return _.map(r.results['annotationQuery'].tables[0].rows, v => {
        return {
          annotation: annotation,
          time: Date.parse(v[0]),
          title: v[1],
          tags: [v[2]],
          text: v[3],
        };
      });
    });
  }

  targetContainsTemplate(target: any) {
    return (
      this.templateSrv.variableExists(target.region) ||
      this.templateSrv.variableExists(target.namespace) ||
      this.templateSrv.variableExists(target.metricName) ||
      _.find(target.dimensions, (v, k) => {
        return this.templateSrv.variableExists(k) || this.templateSrv.variableExists(v);
      })
    );
  }

  testDatasource() {
    // use billing metrics for test
    const region = this.defaultRegion;
    const namespace = 'AWS/Billing';
    const metricName = 'EstimatedCharges';
    const dimensions = {};

    return this.getDimensionValues(region, namespace, metricName, 'ServiceName', dimensions).then(() => {
      return { status: 'success', message: 'Data source is working' };
    });
  }

  awsRequest(url: string, data: any) {
    const options = {
      method: 'POST',
      url,
      data,
    };

    return this.backendSrv.datasourceRequest(options).then((result: any) => {
      return result.data;
    });
  }

  getDefaultRegion() {
    return this.defaultRegion;
  }

  getActualRegion(region: string) {
    if (region === 'default' || _.isEmpty(region)) {
      return this.getDefaultRegion();
    }
    return region;
  }

  convertToCloudWatchTime(date: any, roundUp: any) {
    if (_.isString(date)) {
      date = dateMath.parse(date, roundUp);
    }
    return Math.round(date.valueOf() / 1000);
  }

  convertDimensionFormat(dimensions: { [key: string]: string | string[] }, scopedVars: ScopedVars) {
    return Object.entries(dimensions).reduce((result, [key, value]) => {
      key = this.replace(key, scopedVars, true, 'dimension keys');

      if (Array.isArray(value)) {
        return { ...result, [key]: value };
      }

      const valueVar = this.templateSrv.variables.find(({ name }) => name === this.templateSrv.getVariableName(value));
      if (valueVar) {
        if (valueVar.multi) {
          const values = this.templateSrv.replace(value, scopedVars, 'pipe').split('|');
          return { ...result, [key]: values };
        }
        return { ...result, [key]: [this.templateSrv.replace(value, scopedVars)] };
      }

      return { ...result, [key]: [value] };
    }, {});
  }

  replace(target: string, scopedVars: ScopedVars, displayErrorIfIsMultiTemplateVariable?: boolean, fieldName?: string) {
    if (displayErrorIfIsMultiTemplateVariable) {
      const variable = this.templateSrv.variables.find(({ name }) => name === this.templateSrv.getVariableName(target));
      if (variable && variable.multi) {
        this.debouncedCustomAlert(
          'CloudWatch templating error',
          `Multi template variables are not supported for ${fieldName || target}`
        );
      }
    }

    return this.templateSrv.replace(target, scopedVars);
  }
}
