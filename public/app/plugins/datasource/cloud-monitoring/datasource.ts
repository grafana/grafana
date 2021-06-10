import { chunk, flatten, isString } from 'lodash';

import {
  DataQueryRequest,
  DataSourceInstanceSettings,
  ScopedVars,
  SelectableValue,
  DataQueryResponse,
} from '@grafana/data';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';

import { CloudMonitoringOptions, CloudMonitoringQuery, Filter, MetricDescriptor, QueryType, EditorMode } from './types';
import API from './api';
import { DataSourceWithBackend, toDataQueryResponse } from '@grafana/runtime';
import { CloudMonitoringVariableSupport } from './variables';
import { catchError, map, mergeMap } from 'rxjs/operators';
import { from, Observable, of, throwError } from 'rxjs';

export default class CloudMonitoringDatasource extends DataSourceWithBackend<
  CloudMonitoringQuery,
  CloudMonitoringOptions
> {
  api: API;
  authenticationType: string;
  intervalMs: number;

  constructor(
    private instanceSettings: DataSourceInstanceSettings<CloudMonitoringOptions>,
    public templateSrv: TemplateSrv = getTemplateSrv(),
    private readonly timeSrv: TimeSrv = getTimeSrv()
  ) {
    super(instanceSettings);
    this.authenticationType = instanceSettings.jsonData.authenticationType || 'jwt';
    this.api = new API(`${instanceSettings.url!}/cloudmonitoring/v3/projects/`);
    this.variables = new CloudMonitoringVariableSupport(this);
    this.intervalMs = 0;
  }

  getVariables() {
    return this.templateSrv.getVariables().map((v) => `$${v.name}`);
  }

  query(request: DataQueryRequest<CloudMonitoringQuery>): Observable<DataQueryResponse> {
    request.targets = request.targets.map((t) => ({
      ...this.migrateQuery(t),
      intervalMs: request.intervalMs,
    }));
    return super.query(request);
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

    return this.api
      .post({
        from: options.range.from.valueOf().toString(),
        to: options.range.to.valueOf().toString(),
        queries,
      })
      .pipe(
        map(({ data }) => {
          const dataQueryResponse = toDataQueryResponse({
            data: data,
          });
          const df: any = [];
          if (dataQueryResponse.data.length !== 0) {
            for (let i = 0; i < dataQueryResponse.data.length; i++) {
              for (let j = 0; j < dataQueryResponse.data[i].fields[0].values.length; j++) {
                df.push({
                  annotation: annotation,
                  time: Date.parse(dataQueryResponse.data[i].fields[0].values.get(j)),
                  title: dataQueryResponse.data[i].fields[1].values.get(j),
                  tags: [],
                  text: dataQueryResponse.data[i].fields[3].values.get(j),
                });
              }
            }
          }
          return df;
        })
      )
      .toPromise();
  }

  applyTemplateVariables(
    { metricQuery, refId, queryType, sloQuery }: CloudMonitoringQuery,
    scopedVars: ScopedVars
  ): Record<string, any> {
    return {
      datasourceId: this.id,
      refId,
      intervalMs: this.intervalMs,
      type: 'timeSeriesQuery',
      queryType,
      metricQuery: {
        ...this.interpolateProps(metricQuery, scopedVars),
        projectName: this.templateSrv.replace(
          metricQuery.projectName ? metricQuery.projectName : this.getDefaultProject(),
          scopedVars
        ),
        filters: this.interpolateFilters(metricQuery.filters || [], scopedVars),
        groupBys: this.interpolateGroupBys(metricQuery.groupBys || [], scopedVars),
        view: metricQuery.view || 'FULL',
        editorMode: metricQuery.editorMode,
      },
      sloQuery: sloQuery && this.interpolateProps(sloQuery, scopedVars),
    };
  }

  async getLabels(metricType: string, refId: string, projectName: string, groupBys?: string[]) {
    const options = {
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
    } as DataQueryRequest<CloudMonitoringQuery>;

    const queries = options.targets;

    if (!queries.length) {
      return of({ results: [] }).toPromise();
    }

    return from(this.ensureGCEDefaultProject())
      .pipe(
        mergeMap(() => {
          return this.api.post({
            from: options.range.from.valueOf().toString(),
            to: options.range.to.valueOf().toString(),
            queries,
          });
        }),
        map(({ data }) => {
          return data;
        }),
        map((response) => {
          const result = response.results[refId];
          return result && result.meta ? result.meta.labels : {};
        })
      )
      .toPromise();
  }

  async testDatasource() {
    let status, message;
    const defaultErrorMessage = 'Cannot connect to Google Cloud Monitoring API';
    try {
      await this.ensureGCEDefaultProject();
      const response = await this.api.test(this.getDefaultProject());
      if (response.status === 200) {
        status = 'success';
        message = 'Successfully queried the Google Cloud Monitoring API.';
      } else {
        status = 'error';
        message = response.statusText ? response.statusText : defaultErrorMessage;
      }
    } catch (error) {
      status = 'error';
      if (isString(error)) {
        message = error;
      } else {
        message = 'Google Cloud Monitoring: ';
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
      .pipe(
        map(({ data }) => {
          return data && data.results && data.results.getGCEDefaultProject && data.results.getGCEDefaultProject.meta
            ? data.results.getGCEDefaultProject.meta.defaultProject
            : '';
        }),
        catchError((err) => {
          return throwError(err.data.error);
        })
      )
      .toPromise();
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
      responseMap: (m: MetricDescriptor) => {
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
    return this.api.get(`${this.templateSrv.replace(projectName)}/services?pageSize=1000`, {
      responseMap: ({ name, displayName }: { name: string; displayName: string }) => ({
        value: name.match(/([^\/]*)\/*$/)![1],
        label: displayName || name.match(/([^\/]*)\/*$/)![1],
      }),
    });
  }

  async getServiceLevelObjectives(projectName: string, serviceId: string): Promise<Array<SelectableValue<string>>> {
    if (!serviceId) {
      return Promise.resolve([]);
    }
    let { projectName: p, serviceId: s } = this.interpolateProps({ projectName, serviceId });
    return this.api.get(`${p}/services/${s}/serviceLevelObjectives`, {
      responseMap: ({ name, displayName, goal }: { name: string; displayName: string; goal: number }) => ({
        value: name.match(/([^\/]*)\/*$/)![1],
        label: displayName,
        goal,
      }),
    });
  }

  getProjects(): Promise<Array<SelectableValue<string>>> {
    return this.api.get(`projects`, {
      responseMap: ({ projectId, name }: { projectId: string; name: string }) => ({
        value: projectId,
        label: name,
      }),
      baseUrl: `${this.instanceSettings.url!}/cloudresourcemanager/v1/`,
    });
  }

  migrateQuery(query: CloudMonitoringQuery): CloudMonitoringQuery {
    if (!query.hasOwnProperty('metricQuery')) {
      const { hide, refId, datasource, key, queryType, maxLines, metric, intervalMs, type, ...rest } = query as any;
      return {
        refId,
        intervalMs,
        type,
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

  interpolateProps<T extends Record<string, any>>(object: T, scopedVars: ScopedVars = {}): T {
    return Object.entries(object).reduce((acc, [key, value]) => {
      return {
        ...acc,
        [key]: value && isString(value) ? this.templateSrv.replace(value, scopedVars) : value,
      };
    }, {} as T);
  }

  filterQuery(query: CloudMonitoringQuery): boolean {
    if (query.hide) {
      return false;
    }

    if (query.queryType && query.queryType === QueryType.SLO && query.sloQuery) {
      const { selectorName, serviceId, sloId, projectName } = query.sloQuery;
      return !!selectorName && !!serviceId && !!sloId && !!projectName;
    }

    if (query.queryType && query.queryType === QueryType.METRICS && query.metricQuery.editorMode === EditorMode.MQL) {
      return !!query.metricQuery.projectName && !!query.metricQuery.query;
    }

    const { metricType } = query.metricQuery;

    return !!metricType;
  }

  interpolateVariablesInQueries(queries: CloudMonitoringQuery[], scopedVars: ScopedVars): CloudMonitoringQuery[] {
    return queries.map(
      (query) => this.applyTemplateVariables(this.migrateQuery(query), scopedVars) as CloudMonitoringQuery
    );
  }

  interpolateFilters(filters: string[], scopedVars: ScopedVars) {
    const completeFilter: Filter[] = chunk(filters, 4)
      .map(([key, operator, value, condition]) => ({
        key,
        operator,
        value,
        ...(condition && { condition }),
      }))
      .reduce((res, filter) => (filter.value ? [...res, filter] : res), []);

    const filterArray = flatten(
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
    (groupBys || []).forEach((gb) => {
      const interpolated = this.templateSrv.replace(gb, scopedVars || {}, 'csv').split(',');
      if (Array.isArray(interpolated)) {
        interpolatedGroupBys = interpolatedGroupBys.concat(interpolated);
      } else {
        interpolatedGroupBys.push(interpolated);
      }
    });
    return interpolatedGroupBys;
  }
}
