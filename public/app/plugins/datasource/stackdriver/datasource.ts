import { stackdriverUnitMappings } from './constants';
import appEvents from 'app/core/app_events';
import _ from 'lodash';
import StackdriverMetricFindQuery from './StackdriverMetricFindQuery';
import { StackdriverQuery, MetricDescriptor, StackdriverOptions, Filter, VariableQueryData, QueryType } from './types';
import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  ScopedVars,
  SelectableValue,
} from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { CoreEvents } from 'app/types';

export default class StackdriverDatasource extends DataSourceApi<StackdriverQuery, StackdriverOptions> {
  url: string;
  baseUrl: string;
  projectList: Array<{ label: string; value: string }>;
  authenticationType: string;
  queryPromise: Promise<any>;
  metricTypesCache: { [key: string]: MetricDescriptor[] };
  gceDefaultProject: string;
  sloServicesCache: { [key: string]: Array<SelectableValue<string>> };
  sloCache: { [key: string]: Array<SelectableValue<string>> };

  /** @ngInject */
  constructor(
    private instanceSettings: DataSourceInstanceSettings<StackdriverOptions>,
    public templateSrv: TemplateSrv,
    private timeSrv: TimeSrv
  ) {
    super(instanceSettings);
    this.baseUrl = `/stackdriver/`;
    this.url = instanceSettings.url!;
    this.authenticationType = instanceSettings.jsonData.authenticationType || 'jwt';
    this.metricTypesCache = {};
    this.sloServicesCache = {};
    this.sloCache = {};
  }

  get variables() {
    return this.templateSrv.getVariables().map(v => `$${v.name}`);
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
          projectName: this.templateSrv.replace(rest.projectName ? rest.projectName : this.getDefaultProject()),
        },
      };
    }
    return query;
  }

  interpolateQueryProps(object: { [key: string]: any } = {}, scopedVars: ScopedVars) {
    return Object.entries(object).reduce((acc, [key, value]) => {
      return {
        ...acc,
        [key]: value && _.isString(value) ? this.templateSrv.replace(value, scopedVars || {}) : value,
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
    }

    const { metricType, projectName } = query.metricQuery;

    return !!metricType && !!projectName;
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
        ...this.interpolateQueryProps(metricQuery, scopedVars),
        filters: this.interpolateFilters(metricQuery.filters || [], scopedVars),
        groupBys: this.interpolateGroupBys(metricQuery.groupBys || [], scopedVars),
        view: metricQuery.view || 'FULL',
      },
      sloQuery: this.interpolateQueryProps(sloQuery, scopedVars),
    };
  }

  async getTimeSeries(options: DataQueryRequest<StackdriverQuery>) {
    await this.ensureGCEDefaultProject();
    const queries = options.targets
      .map(this.migrateQuery)
      .filter(this.shouldRunQuery)
      .map(q => this.prepareTimeSeriesQuery(q, options));

    if (queries.length > 0) {
      const { data } = await getBackendSrv().datasourceRequest({
        url: '/api/tsdb/query',
        method: 'POST',
        data: {
          from: options.range.from.valueOf().toString(),
          to: options.range.to.valueOf().toString(),
          queries,
        },
      });
      return data;
    } else {
      return { results: [] };
    }
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

  async getLabels(metricType: string, refId: string, projectName: string, groupBys?: string[]) {
    const response = await this.getTimeSeries({
      targets: [
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
        },
      ],
      range: this.timeSrv.timeRange(),
    } as DataQueryRequest<StackdriverQuery>);
    const result = response.results[refId];
    return result && result.meta ? result.meta.labels : {};
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

  async query(options: DataQueryRequest<StackdriverQuery>): Promise<DataQueryResponse> {
    const result: DataQueryResponse[] = [];
    const data = await this.getTimeSeries(options);
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
      return { data: result };
    } else {
      return { data: [] };
    }
  }

  async annotationQuery(options: any) {
    await this.ensureGCEDefaultProject();
    const annotation = options.annotation;
    const queries = [
      {
        refId: 'annotationQuery',
        datasourceId: this.id,
        metricType: this.templateSrv.replace(annotation.target.metricType, options.scopedVars || {}),
        crossSeriesReducer: 'REDUCE_NONE',
        perSeriesAligner: 'ALIGN_NONE',
        title: this.templateSrv.replace(annotation.target.title, options.scopedVars || {}),
        text: this.templateSrv.replace(annotation.target.text, options.scopedVars || {}),
        tags: this.templateSrv.replace(annotation.target.tags, options.scopedVars || {}),
        view: 'FULL',
        filters: this.interpolateFilters(annotation.target.filters || [], options.scopedVars),
        type: 'annotationQuery',
        projectName: this.templateSrv.replace(
          annotation.target.projectName ? annotation.target.projectName : this.getDefaultProject(),
          options.scopedVars || {}
        ),
      },
    ];

    const { data } = await getBackendSrv().datasourceRequest({
      url: '/api/tsdb/query',
      method: 'POST',
      data: {
        from: options.range.from.valueOf().toString(),
        to: options.range.to.valueOf().toString(),
        queries,
      },
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

  async testDatasource() {
    let status, message;
    const defaultErrorMessage = 'Cannot connect to Stackdriver API';
    try {
      await this.ensureGCEDefaultProject();
      const path = `v3/projects/${this.getDefaultProject()}/metricDescriptors`;
      const response = await this.doRequest(`${this.baseUrl}${path}`);
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
    return getBackendSrv()
      .datasourceRequest({
        url: '/api/tsdb/query',
        method: 'POST',
        data: {
          queries: [
            {
              refId: 'getGCEDefaultProject',
              type: 'getGCEDefaultProject',
              datasourceId: this.id,
            },
          ],
        },
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

  formatStackdriverError(error: any) {
    let message = 'Stackdriver: ';
    message += error.statusText ? error.statusText + ': ' : '';
    if (error.data && error.data.error) {
      try {
        const res = JSON.parse(error.data.error);
        message += res.error.code + '. ' + res.error.message;
      } catch (err) {
        message += error.data.error;
      }
    } else {
      message += 'Cannot connect to Stackdriver API';
    }
    return message;
  }

  async getProjects() {
    try {
      const { data } = await getBackendSrv().datasourceRequest({
        url: '/api/tsdb/query',
        method: 'POST',
        data: {
          queries: [
            {
              refId: 'getProjectsListQuery',
              type: 'getProjectsListQuery',
              datasourceId: this.id,
            },
          ],
        },
      });
      return data.results.getProjectsListQuery.meta.projectsList;
    } catch (error) {
      console.log(this.formatStackdriverError(error));
      return [];
    }
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
    try {
      if (!projectName) {
        return [];
      }

      const interpolatedProject = this.templateSrv.replace(projectName);
      if (this.metricTypesCache[interpolatedProject]) {
        return this.metricTypesCache[interpolatedProject];
      }

      const metricsApiPath = `v3/projects/${interpolatedProject}/metricDescriptors`;
      const { data } = await this.doRequest(`${this.baseUrl}${metricsApiPath}`);

      this.metricTypesCache[interpolatedProject] = data.metricDescriptors.map((m: any) => {
        const [service] = m.type.split('/');
        const [serviceShortName] = service.split('.');
        m.service = service;
        m.serviceShortName = serviceShortName;
        m.displayName = m.displayName || m.type;

        return m;
      });

      return this.metricTypesCache[interpolatedProject];
    } catch (error) {
      appEvents.emit(CoreEvents.dsRequestError, { error: { data: { error: this.formatStackdriverError(error) } } });
      return [];
    }
  }

  async getSLOServices(projectName: string): Promise<Array<SelectableValue<string>>> {
    try {
      if (!projectName) {
        return [];
      }

      const interpolatedProject = this.templateSrv.replace(projectName);
      if (this.sloServicesCache[interpolatedProject]) {
        return this.sloServicesCache[interpolatedProject];
      }

      const { data } = await this.doRequest(`${this.baseUrl}v3/projects/${interpolatedProject}/services`);
      console.log({ data });
      this.sloServicesCache[interpolatedProject] = data.services.map(
        ({ name, displayName }: { name: string; displayName: string }) => ({
          value: name.match(/([^\/]*)\/*$/)[1],
          label: name.match(/([^\/]*)\/*$/)[1],
          // label: displayName.match(/([^\/]*)\/*$/)[1],
        })
      );

      return this.sloServicesCache[interpolatedProject];
    } catch (error) {
      appEvents.emit(CoreEvents.dsRequestError, { error: { data: { error: this.formatStackdriverError(error) } } });
      return [];
    }
  }

  async getServiceLevelObjectives(projectName: string, serviceId: string): Promise<Array<SelectableValue<string>>> {
    try {
      const interpolatedProject = this.templateSrv.replace(projectName);
      const interpolatedServiceId = this.templateSrv.replace(serviceId);
      const cacheKey = `${interpolatedProject}-${interpolatedServiceId}`;
      if (this.sloCache[cacheKey]) {
        return this.sloCache[cacheKey];
      }

      const { data } = await this.doRequest(
        `${this.baseUrl}v3/projects/${interpolatedProject}/services/${interpolatedServiceId}/serviceLevelObjectives`
      );
      console.log({ data });
      this.sloCache[cacheKey] = data.serviceLevelObjectives.map(
        ({ name, displayName }: { name: string; displayName: string }) => ({
          value: name.match(/([^\/]*)\/*$/)[1],
          label: name.match(/([^\/]*)\/*$/)[1],
          // label: displayName.match(/([^\/]*)\/*$/)[1],
        })
      );

      return this.sloCache[cacheKey];
    } catch (error) {
      appEvents.emit(CoreEvents.dsRequestError, { error: { data: { error: this.formatStackdriverError(error) } } });
      return [];
    }
  }

  async doRequest(url: string, maxRetries = 1): Promise<any> {
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
}
