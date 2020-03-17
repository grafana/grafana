import { stackdriverUnitMappings } from './constants';
import appEvents from 'app/core/app_events';
import _ from 'lodash';
import StackdriverMetricFindQuery from './StackdriverMetricFindQuery';
import { StackdriverQuery, MetricDescriptor, StackdriverOptions, Filter, VariableQueryData } from './types';
import {
  DataSourceApi,
  DataQueryRequest,
  DataSourceInstanceSettings,
  ScopedVars,
  DataQueryResponse,
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
  }

  get variables() {
    return this.templateSrv.variables.map(v => `$${v.name}`);
  }

  async getTimeSeries(options: DataQueryRequest<StackdriverQuery>) {
    await this.ensureGCEDefaultProject();
    const queries = options.targets
      .filter((target: StackdriverQuery) => {
        return !target.hide && target.metricType;
      })
      .map((t: StackdriverQuery) => {
        return {
          refId: t.refId,
          intervalMs: options.intervalMs,
          datasourceId: this.id,
          metricType: this.templateSrv.replace(t.metricType, options.scopedVars || {}),
          crossSeriesReducer: this.templateSrv.replace(t.crossSeriesReducer || 'REDUCE_MEAN', options.scopedVars || {}),
          perSeriesAligner: this.templateSrv.replace(t.perSeriesAligner, options.scopedVars || {}),
          alignmentPeriod: this.templateSrv.replace(t.alignmentPeriod!, options.scopedVars || {}),
          groupBys: this.interpolateGroupBys(t.groupBys || [], options.scopedVars),
          view: t.view || 'FULL',
          filters: this.interpolateFilters(t.filters || [], options.scopedVars),
          aliasBy: this.templateSrv.replace(t.aliasBy!, options.scopedVars || {}),
          type: 'timeSeriesQuery',
          projectName: this.templateSrv.replace(t.projectName ? t.projectName : this.getDefaultProject()),
        };
      });

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
      .map(([key, operator, value, condition = 'AND']) => ({
        key,
        operator,
        value,
        condition,
      }))
      .reduce((res, filter) => (filter.value ? [...res, filter] : res), []);

    const filterArray = _.flatten(
      completeFilter.map(({ key, operator, value, condition }: Filter) => [
        this.templateSrv.replace(key, scopedVars || {}),
        operator,
        this.templateSrv.replace(value, scopedVars || {}, 'regex'),
        condition,
      ])
    );

    return filterArray || [];
  }

  async getLabels(metricType: string, refId: string, projectName: string, groupBys?: string[]) {
    const response = await this.getTimeSeries({
      targets: [
        {
          refId: refId,
          datasourceId: this.id,
          projectName: this.templateSrv.replace(projectName),
          metricType: this.templateSrv.replace(metricType),
          groupBys: this.interpolateGroupBys(groupBys || [], {}),
          crossSeriesReducer: 'REDUCE_NONE',
          view: 'HEADERS',
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

  resolvePanelUnitFromTargets(targets: StackdriverQuery[]) {
    let unit;
    if (targets.length > 0 && targets.every(t => t.unit === targets[0].unit)) {
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
