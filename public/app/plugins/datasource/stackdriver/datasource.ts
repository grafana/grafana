import _ from 'lodash';

import {
  TimeRange,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  ScopedVars,
  SelectableValue,
  ArrayVector,
  FieldType,
  DataQueryResponseData,
} from '@grafana/data';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';

import { StackdriverQuery, MetricDescriptor, StackdriverOptions, Filter, VariableQueryData, QueryType } from './types';
import { stackdriverUnitMappings } from './constants';
import API from './api';
import StackdriverMetricFindQuery from './StackdriverMetricFindQuery';

export default class StackdriverDatasource extends DataSourceApi<StackdriverQuery, StackdriverOptions> {
  api: API;
  authenticationType: string;

  /** @ngInject */
  constructor(
    private instanceSettings: DataSourceInstanceSettings<StackdriverOptions>,
    public templateSrv: TemplateSrv,
    private timeSrv: TimeSrv
  ) {
    super(instanceSettings);
    this.authenticationType = instanceSettings.jsonData.authenticationType || 'jwt';
    this.api = new API(`${instanceSettings.url!}/stackdriver/v3/projects/`);
  }

  get variables() {
    return this.templateSrv.getVariables().map(v => `$${v.name}`);
  }

  async query(options: DataQueryRequest<StackdriverQuery>): Promise<DataQueryResponse> {
    await this.ensureGCEDefaultProject();
    const queries = options.targets.map(this.migrateQuery).filter(this.shouldRunQuery);
    const logQueries = queries.filter(({ queryType }) => queryType === QueryType.LOGS);
    const timeSeriesQueries = queries.filter(({ queryType }) => queryType !== QueryType.LOGS);
    return Promise.all([
      this.getTimeSeries(options, timeSeriesQueries).then(res => this.mapTimeSeriesResult(options, res)),
      ...logQueries.map(query => this.getLogs(options.range!, query)),
    ])
      .then((queryResults: DataQueryResponseData[]) => ({ data: _.flatten(queryResults) }))
      .catch(error => {
        return { data: null, error };
      });
  }

  async annotationQuery(options: any) {
    await this.ensureGCEDefaultProject();
    const annotation = options.annotation;
    const queries = [
      {
        refId: 'annotationQuery',
        type: 'annotationQuery',
        datasourceId: this.id,
        view: 'FULL',
        crossSeriesReducer: 'REDUCE_NONE',
        perSeriesAligner: 'ALIGN_NONE',
        metricType: this.templateSrv.replace(annotation.target.metricType, options.scopedVars || {}),
        title: this.templateSrv.replace(annotation.target.title, options.scopedVars || {}),
        text: this.templateSrv.replace(annotation.target.text, options.scopedVars || {}),
        tags: this.templateSrv.replace(annotation.target.tags, options.scopedVars || {}),
        projectName: this.templateSrv.replace(
          annotation.target.projectName ? annotation.target.projectName : this.getDefaultProject(),
          options.scopedVars || {}
        ),
        filters: this.interpolateFilters(annotation.target.filters || [], options.scopedVars),
      },
    ];

    const { data } = await this.api.post({
      from: options.range.from.valueOf().toString(),
      to: options.range.to.valueOf().toString(),
      queries,
    });

    const results = data.results['annotationQuery'].tables[0].rows.map((v: any) => {
      return {
        annotation: annotation,
        time: Date.parse(v[0]),
        title: v[1],
        tags: [],
        text: v[3],
      } as any;
    });

    return results;
  }

  async metricFindQuery(query: VariableQueryData) {
    await this.ensureGCEDefaultProject();
    const stackdriverMetricFindQuery = new StackdriverMetricFindQuery(this);
    return stackdriverMetricFindQuery.execute(query);
  }

  async getLogs({ from, to }: TimeRange, query: StackdriverQuery): Promise<DataQueryResponseData> {
    const { projectName, filter, ...body } = query.logsQuery;
    return this.api
      .post(
        {
          // 'resource.type="gce_instance"\nresource.labels.instance_id="6182112311011168237"\n\n timestamp<="2020-02-27T13:19:02.187000000Z" timestamp<"2020-02-27T13:18:52.497Z" timestamp>="2020-02-27T12:19:02.187Z" timestamp<="2020-02-27T13:19:02.187Z"',
          ...body,
          filter: `${filter} timestamp<="${from.valueOf().toString()}" timestamp<="${to.valueOf().toString()}"`,
          resourceNames: [`projects/${projectName}`],
        },
        `${this.instanceSettings.url}/stackdriver-logging/v2/entries:list`
      )
      .then(({ data }) => {
        const times = new ArrayVector<string>([]);
        const lines = new ArrayVector<string>([]);
        const ids = new ArrayVector<string>([]);

        for (const entry of data.entries) {
          times.add(entry.timestamp);
          lines.add(entry.textPayload);
          ids.add(entry.insertId);
        }

        const dataFrame = {
          refId: query.refId,
          fields: [
            { name: 'ts', type: FieldType.time, config: { title: 'Time' }, values: times }, // Time
            { name: 'line', type: FieldType.string, config: {}, values: lines }, // Line
            { name: 'id', type: FieldType.string, config: {}, values: ids },
          ],
          length: times.length,
        } as DataQueryResponseData;

        return dataFrame;
      })
      .catch(err => {
        console.error({ err });
        throw err?.data?.error?.message ?? 'Invalid Logs Query';
      });
  }

  async getTimeSeries(options: DataQueryRequest<StackdriverQuery>, queries: StackdriverQuery[]) {
    if (queries.length > 0) {
      const { data } = await this.api.post({
        from: options.range.from.valueOf().toString(),
        to: options.range.to.valueOf().toString(),
        queries: queries.map(q => this.prepareTimeSeriesQuery(q, options)),
      });
      return data;
    } else {
      return [];
    }
  }

  async getLabels(metricType: string, refId: string, projectName: string, groupBys?: string[]) {
    await this.ensureGCEDefaultProject();
    const response = await this.getTimeSeries(
      { range: this.timeSrv.timeRange() } as DataQueryRequest<StackdriverQuery>,
      [
        {
          refId,
          datasourceId: this.id,
          queryType: QueryType.METRICS,
          metricQuery: {
            projectName: this.templateSrv.replace(projectName),
            metricType: this.templateSrv.replace(metricType),
            groupBys: this.interpolateGroupBys(groupBys || [], {}),
            crossSeriesReducer: 'REDUCE_NONE',
            view: 'HEADERS',
          },
        } as StackdriverQuery,
      ]
    );
    const result = response.results[refId];
    return result && result.meta ? result.meta.labels : {};
  }

  async testDatasource() {
    let status, message;
    const defaultErrorMessage = 'Cannot connect to Stackdriver API';
    try {
      await this.ensureGCEDefaultProject();
      const response = await this.api.test(this.getDefaultProject());
      if (response.status === 200) {
        status = 'success';
        message = 'Successfully queried the Stackdriver API.';
      } else {
        status = 'error';
        message = response.statusText ? response.statusText : defaultErrorMessage;
      }
    } catch (error) {
      status = 'error';
      if (_.isString(error)) {
        message = error;
      } else {
        message = 'Stackdriver: ';
        message += error.statusText ? error.statusText : defaultErrorMessage;
        if (error.data && error.data.error && error.data.error.code) {
          message += ': ' + error.data.error.code + '. ' + error.data.error.message;
        }
      }
    } finally {
      return {
        status,
        message,
      };
    }
  }

  async getGCEDefaultProject() {
    return this.api
      .post({
        queries: [
          {
            refId: 'getGCEDefaultProject',
            type: 'getGCEDefaultProject',
            datasourceId: this.id,
          },
        ],
      })
      .then(({ data }) => {
        return data && data.results && data.results.getGCEDefaultProject && data.results.getGCEDefaultProject.meta
          ? data.results.getGCEDefaultProject.meta.defaultProject
          : '';
      })
      .catch(err => {
        throw err.data.error;
      });
  }

  getDefaultProject(): string {
    const { defaultProject, authenticationType, gceDefaultProject } = this.instanceSettings.jsonData;
    if (authenticationType === 'gce') {
      return gceDefaultProject || '';
    }

    return defaultProject || '';
  }

  async ensureGCEDefaultProject() {
    const { authenticationType, gceDefaultProject } = this.instanceSettings.jsonData;
    if (authenticationType === 'gce' && !gceDefaultProject) {
      this.instanceSettings.jsonData.gceDefaultProject = await this.getGCEDefaultProject();
    }
  }

  async getMetricTypes(projectName: string): Promise<MetricDescriptor[]> {
    if (!projectName) {
      return [];
    }

    return this.api.get(`${this.templateSrv.replace(projectName)}/metricDescriptors`, {
      responseMap: (m: any) => {
        const [service] = m.type.split('/');
        const [serviceShortName] = service.split('.');
        m.service = service;
        m.serviceShortName = serviceShortName;
        m.displayName = m.displayName || m.type;

        return m;
      },
    }) as Promise<MetricDescriptor[]>;
  }

  async getSLOServices(projectName: string): Promise<Array<SelectableValue<string>>> {
    return this.api.get(`${this.templateSrv.replace(projectName)}/services`, {
      responseMap: ({ name }: { name: string }) => ({
        value: name.match(/([^\/]*)\/*$/)[1],
        label: name.match(/([^\/]*)\/*$/)[1],
      }),
    });
  }

  async getServiceLevelObjectives(projectName: string, serviceId: string): Promise<Array<SelectableValue<string>>> {
    let { projectName: p, serviceId: s } = this.interpolateProps({ projectName, serviceId });
    return this.api.get(`${p}/services/${s}/serviceLevelObjectives`, {
      responseMap: ({ name, displayName, goal }: { name: string; displayName: string; goal: number }) => ({
        value: name.match(/([^\/]*)\/*$/)[1],
        label: displayName,
        goal,
      }),
    });
  }

  async getProjects() {
    return this.api.get(`projects`, {
      responseMap: ({ projectId, name }: { projectId: string; name: string }) => ({
        value: projectId,
        label: name,
      }),
      baseUrl: `${this.instanceSettings.url!}/cloudresourcemanager/v1/`,
    });
  }

  migrateQuery(query: StackdriverQuery): StackdriverQuery {
    if (!query.hasOwnProperty('metricQuery')) {
      const { hide, refId, datasource, key, queryType, maxLines, metric, ...rest } = query as any;
      return {
        refId,
        hide,
        queryType: QueryType.METRICS,
        metricQuery: {
          ...rest,
          view: rest.view || 'FULL',
        },
      };
    }
    return query;
  }

  mapTimeSeriesResult(options: DataQueryRequest<StackdriverQuery>, data: any): DataQueryResponseData[] {
    const result: DataQueryResponseData[] = [];
    if (data.results) {
      Object.values(data.results).forEach((queryRes: any) => {
        if (!queryRes.series) {
          return;
        }
        const unit = this.resolvePanelUnitFromTargets(options.targets);
        queryRes.series.forEach((series: any) => {
          let timeSerie: any = {
            target: series.name,
            datapoints: series.points,
            refId: queryRes.refId,
            meta: queryRes.meta,
          };
          if (unit) {
            timeSerie = { ...timeSerie, unit };
          }
          result.push(timeSerie);
        });
      });
      return result;
      // return { data: result };
    } else {
      return [];
      // return { data: [] };
    }
  }

  interpolateProps(object: { [key: string]: any } = {}, scopedVars: ScopedVars = {}): { [key: string]: any } {
    return Object.entries(object).reduce((acc, [key, value]) => {
      return {
        ...acc,
        [key]: value && _.isString(value) ? this.templateSrv.replace(value, scopedVars) : value,
      };
    }, {});
  }

  shouldRunQuery(query: StackdriverQuery): boolean {
    if (query.hide) {
      return false;
    }

    if (query.queryType && query.queryType === QueryType.SLO) {
      const { selectorName, serviceId, sloId, projectName } = query.sloQuery;
      return !!selectorName && !!serviceId && !!sloId && !!projectName;
    } else if (query.queryType && query.queryType === QueryType.LOGS) {
      const { filter, projectName } = query.logsQuery;
      return !!filter && !!projectName;
    }

    const { metricType } = query.metricQuery;

    return !!metricType;
  }

  prepareTimeSeriesQuery(
    { metricQuery, refId, queryType, sloQuery }: StackdriverQuery,
    { scopedVars, intervalMs }: DataQueryRequest<StackdriverQuery>
  ) {
    return {
      datasourceId: this.id,
      refId,
      queryType,
      intervalMs: intervalMs,
      type: 'timeSeriesQuery',
      metricQuery: {
        ...this.interpolateProps(metricQuery, scopedVars),
        projectName: this.templateSrv.replace(
          metricQuery.projectName ? metricQuery.projectName : this.getDefaultProject()
        ),
        filters: this.interpolateFilters(metricQuery.filters || [], scopedVars),
        groupBys: this.interpolateGroupBys(metricQuery.groupBys || [], scopedVars),
        view: metricQuery.view || 'FULL',
      },
      sloQuery: this.interpolateProps(sloQuery, scopedVars),
    };
  }

  interpolateFilters(filters: string[], scopedVars: ScopedVars) {
    const completeFilter = _.chunk(filters, 4)
      .map(([key, operator, value, condition]) => ({
        key,
        operator,
        value,
        ...(condition && { condition }),
      }))
      .reduce((res, filter) => (filter.value ? [...res, filter] : res), []);

    const filterArray = _.flatten(
      completeFilter.map(({ key, operator, value, condition }: Filter) => [
        this.templateSrv.replace(key, scopedVars || {}),
        operator,
        this.templateSrv.replace(value, scopedVars || {}, 'regex'),
        ...(condition ? [condition] : []),
      ])
    );

    return filterArray || [];
  }

  interpolateGroupBys(groupBys: string[], scopedVars: {}): string[] {
    let interpolatedGroupBys: string[] = [];
    (groupBys || []).forEach(gb => {
      const interpolated = this.templateSrv.replace(gb, scopedVars || {}, 'csv').split(',');
      if (Array.isArray(interpolated)) {
        interpolatedGroupBys = interpolatedGroupBys.concat(interpolated);
      } else {
        interpolatedGroupBys.push(interpolated);
      }
    });
    return interpolatedGroupBys;
  }

  resolvePanelUnitFromTargets(targets: any) {
    let unit;
    if (targets.length > 0 && targets.every((t: any) => t.unit === targets[0].unit)) {
      if (stackdriverUnitMappings.hasOwnProperty(targets[0].unit!)) {
        // @ts-ignore
        unit = stackdriverUnitMappings[targets[0].unit];
      }
    }
    return unit;
  }
}
