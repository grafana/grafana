import { chunk, flatten, isString, isArray } from 'lodash';
import { from, lastValueFrom, Observable, of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  ScopedVars,
  SelectableValue,
} from '@grafana/data';
import { DataSourceWithBackend, getBackendSrv, toDataQueryResponse } from '@grafana/runtime';

import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import {
  CloudMonitoringOptions,
  CloudMonitoringQuery,
  EditorMode,
  Filter,
  MetricDescriptor,
  QueryType,
  PostResponse,
  Aggregation,
} from './types';
import { CloudMonitoringVariableSupport } from './variables';

export default class CloudMonitoringDatasource extends DataSourceWithBackend<
  CloudMonitoringQuery,
  CloudMonitoringOptions
> {
  authenticationType: string;
  intervalMs: number;

  constructor(
    private instanceSettings: DataSourceInstanceSettings<CloudMonitoringOptions>,
    public templateSrv: TemplateSrv = getTemplateSrv(),
    private readonly timeSrv: TimeSrv = getTimeSrv()
  ) {
    super(instanceSettings);
    this.authenticationType = instanceSettings.jsonData.authenticationType || 'jwt';
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
        datasource: this.getRef(),
        view: 'FULL',
        crossSeriesReducer: 'REDUCE_NONE',
        perSeriesAligner: 'ALIGN_NONE',
        metricType: this.templateSrv.replace(annotation.target.metricType, options.scopedVars || {}),
        title: this.templateSrv.replace(annotation.target.title, options.scopedVars || {}),
        text: this.templateSrv.replace(annotation.target.text, options.scopedVars || {}),
        projectName: this.templateSrv.replace(
          annotation.target.projectName ? annotation.target.projectName : this.getDefaultProject(),
          options.scopedVars || {}
        ),
        filters: this.interpolateFilters(annotation.target.filters || [], options.scopedVars),
      },
    ];

    return lastValueFrom(
      getBackendSrv()
        .fetch<PostResponse>({
          url: '/api/ds/query',
          method: 'POST',
          data: {
            from: options.range.from.valueOf().toString(),
            to: options.range.to.valueOf().toString(),
            queries,
          },
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
    );
  }

  applyTemplateVariables(
    { metricQuery, refId, queryType, sloQuery }: CloudMonitoringQuery,
    scopedVars: ScopedVars
  ): Record<string, any> {
    return {
      datasource: this.getRef(),
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

  async getLabels(metricType: string, refId: string, projectName: string, aggregation?: Aggregation) {
    const options = {
      targets: [
        {
          refId,
          datasource: this.getRef(),
          queryType: QueryType.METRICS,
          metricQuery: {
            projectName: this.templateSrv.replace(projectName),
            metricType: this.templateSrv.replace(metricType),
            groupBys: this.interpolateGroupBys(aggregation?.groupBys || [], {}),
            crossSeriesReducer: aggregation?.crossSeriesReducer ?? 'REDUCE_NONE',
            view: 'HEADERS',
          },
        },
      ],
      range: this.timeSrv.timeRange(),
    } as DataQueryRequest<CloudMonitoringQuery>;

    const queries = options.targets;

    if (!queries.length) {
      return lastValueFrom(of({ results: [] }));
    }

    return lastValueFrom(
      from(this.ensureGCEDefaultProject()).pipe(
        mergeMap(() => {
          return getBackendSrv().fetch<PostResponse>({
            url: '/api/ds/query',
            method: 'POST',
            data: {
              from: options.range.from.valueOf().toString(),
              to: options.range.to.valueOf().toString(),
              queries,
            },
          });
        }),
        map(({ data }) => {
          const dataQueryResponse = toDataQueryResponse({
            data: data,
          });
          return dataQueryResponse?.data[0]?.meta?.custom?.labels ?? {};
        })
      )
    );
  }

  async getGCEDefaultProject() {
    return this.getResource(`gceDefaultProject`);
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

    return this.getResource(
      `metricDescriptors/v3/projects/${this.templateSrv.replace(projectName)}/metricDescriptors`
    ) as Promise<MetricDescriptor[]>;
  }

  async getSLOServices(projectName: string): Promise<Array<SelectableValue<string>>> {
    return this.getResource(`services/v3/projects/${this.templateSrv.replace(projectName)}/services?pageSize=1000`);
  }

  async getServiceLevelObjectives(projectName: string, serviceId: string): Promise<Array<SelectableValue<string>>> {
    if (!serviceId) {
      return Promise.resolve([]);
    }
    let { projectName: p, serviceId: s } = this.interpolateProps({ projectName, serviceId });
    return this.getResource(`slo-services/v3/projects/${p}/services/${s}/serviceLevelObjectives`);
  }

  getProjects(): Promise<Array<SelectableValue<string>>> {
    return this.getResource(`projects`);
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
      .filter((item) => item.value);

    const filterArray = flatten(
      completeFilter.map(({ key, operator, value, condition }: Filter) => [
        this.templateSrv.replace(key, scopedVars || {}),
        operator,
        this.templateSrv.replace(value, scopedVars || {}, (value: string | string[]) => {
          return isArray(value) && value.length ? `(${value.join('|')})` : value;
        }),
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
