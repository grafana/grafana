import { chunk, flatten, isString, isArray, has, get, omit } from 'lodash';
import { from, lastValueFrom, Observable, of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  QueryVariableModel,
  ScopedVars,
  SelectableValue,
  TimeRange,
  getDefaultTimeRange,
} from '@grafana/data';
import {
  DataSourceWithBackend,
  getBackendSrv,
  toDataQueryResponse,
  BackendSrv,
  getTemplateSrv,
  TemplateSrv,
} from '@grafana/runtime';

import { CloudMonitoringAnnotationSupport } from './annotationSupport';
import { SLO_BURN_RATE_SELECTOR_NAME } from './constants';
import { getMetricType, setMetricType } from './functions';
import { CloudMonitoringQuery, QueryType, MetricQuery, Filter } from './types/query';
import { CloudMonitoringOptions, MetricDescriptor, PostResponse, Aggregation } from './types/types';
import { CloudMonitoringVariableSupport } from './variables';

export default class CloudMonitoringDatasource extends DataSourceWithBackend<
  CloudMonitoringQuery,
  CloudMonitoringOptions
> {
  authenticationType: string;
  intervalMs: number;
  backendSrv: BackendSrv;

  constructor(
    private instanceSettings: DataSourceInstanceSettings<CloudMonitoringOptions>,
    public templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.authenticationType = instanceSettings.jsonData.authenticationType || 'jwt';
    this.variables = new CloudMonitoringVariableSupport(this);
    this.intervalMs = 0;
    this.annotations = CloudMonitoringAnnotationSupport(this);
    this.backendSrv = getBackendSrv();
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

  applyTemplateVariables(target: CloudMonitoringQuery, scopedVars: ScopedVars) {
    const { timeSeriesList, timeSeriesQuery, sloQuery, promQLQuery } = target;

    return {
      ...target,
      datasource: this.getRef(),
      intervalMs: this.intervalMs,
      timeSeriesList: timeSeriesList && {
        ...this.interpolateProps(timeSeriesList, scopedVars),
        projectName: this.templateSrv.replace(
          timeSeriesList.projectName ? timeSeriesList.projectName : this.getDefaultProject(),
          scopedVars
        ),
        filters: this.interpolateFilters(timeSeriesList.filters || [], scopedVars),
        groupBys: this.interpolateGroupBys(timeSeriesList.groupBys || [], scopedVars),
        view: timeSeriesList.view || 'FULL',
      },
      timeSeriesQuery: timeSeriesQuery && {
        ...this.interpolateProps(timeSeriesQuery, scopedVars),
        projectName: this.templateSrv.replace(
          timeSeriesQuery.projectName ? timeSeriesQuery.projectName : this.getDefaultProject(),
          scopedVars
        ),
      },
      sloQuery: sloQuery && this.interpolateProps(sloQuery, scopedVars),
      promQLQuery: promQLQuery && this.interpolateProps(promQLQuery, scopedVars, { expr: this.interpolatePromQLQuery }),
    };
  }

  async getLabels(
    metricType: string,
    refId: string,
    projectName: string,
    aggregation?: Aggregation,
    timeRange?: TimeRange
  ): Promise<{ [k: string]: string[] }> {
    const options = {
      targets: [
        {
          refId,
          datasource: this.getRef(),
          queryType: QueryType.TIME_SERIES_LIST,
          timeSeriesList: setMetricType(
            {
              projectName: this.templateSrv.replace(projectName),
              groupBys: this.interpolateGroupBys(aggregation?.groupBys || [], {}),
              // Use REDUCE_NONE to retrieve all available labels for the metric
              crossSeriesReducer: 'REDUCE_NONE',
              view: 'HEADERS',
            },
            this.templateSrv.replace(metricType)
          ),
        },
      ],
      range: timeRange || getDefaultTimeRange(),
    };

    const queries = options.targets;

    if (!queries.length) {
      return lastValueFrom(of({ results: [] }));
    }

    return lastValueFrom(
      from(this.ensureGCEDefaultProject()).pipe(
        mergeMap(() => {
          return this.backendSrv.fetch<PostResponse>({
            url: '/api/ds/query',
            method: 'POST',
            headers: this.getRequestHeaders(),
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

          const labels: Record<string, Set<string>> = dataQueryResponse?.data
            .map((f) => f.meta?.custom?.labels)
            .filter((p) => !!p)
            .reduce((acc, labels) => {
              for (let key in labels) {
                if (!acc[key]) {
                  acc[key] = new Set<string>();
                }
                if (labels[key]) {
                  acc[key].add(labels[key]);
                }
              }
              return acc;
            }, {});

          return Object.fromEntries(
            Object.entries(labels).map(([key, value]) => {
              const fromArr = Array.from(value);
              return [key, fromArr];
            })
          );
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

    return this.getResource(`metricDescriptors/v3/projects/${this.templateSrv.replace(projectName)}/metricDescriptors`);
  }

  async filterMetricsByType(projectName: string, filter: string): Promise<MetricDescriptor[]> {
    if (!projectName) {
      return [];
    }

    return this.getResource(
      `metricDescriptors/v3/projects/${this.templateSrv.replace(projectName)}/metricDescriptors`,
      { filter: `metric.type : "${filter}"` }
    );
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

  migrateMetricTypeFilter(metricType: string, filters?: string[]) {
    const metricTypeFilterArray = ['metric.type', '=', metricType];
    if (filters?.length) {
      return filters.concat('AND', metricTypeFilterArray);
    }
    return metricTypeFilterArray;
  }

  // This is a manual port of the migration code in cloudmonitoring.go
  // DO NOT UPDATE THIS CODE WITHOUT UPDATING THE BACKEND CODE
  migrateQuery(query: CloudMonitoringQuery): CloudMonitoringQuery {
    const { hide, refId, datasource, key, queryType, maxLines, metric, intervalMs, type, ...rest } = query as any;
    if (
      !query.hasOwnProperty('metricQuery') &&
      !query.hasOwnProperty('sloQuery') &&
      !query.hasOwnProperty('timeSeriesQuery') &&
      !query.hasOwnProperty('timeSeriesList')
    ) {
      let filters = rest.filters || [];
      if (rest.metricType) {
        filters = this.migrateMetricTypeFilter(rest.metricType, filters);
      }

      return {
        datasource,
        key,
        refId,
        intervalMs,
        hide,
        queryType: type === 'annotationQuery' ? QueryType.ANNOTATION : QueryType.TIME_SERIES_LIST,
        timeSeriesList: {
          ...rest,
          projectName: get(query, 'projectName') || this.getDefaultProject(),
          filters,
          view: rest.view || 'FULL',
        },
      };
    }

    if (has(query, 'metricQuery') && ['metrics', QueryType.ANNOTATION].includes(query.queryType ?? '')) {
      const metricQuery = get(query, 'metricQuery') as MetricQuery;
      if (metricQuery.editorMode === 'mql') {
        query.timeSeriesQuery = {
          projectName: metricQuery.projectName,
          query: metricQuery.query,
          graphPeriod: metricQuery.graphPeriod,
        };
        query.queryType = QueryType.TIME_SERIES_QUERY;
      } else {
        query.timeSeriesList = {
          projectName: metricQuery.projectName || this.getDefaultProject(),
          crossSeriesReducer: metricQuery.crossSeriesReducer,
          alignmentPeriod: metricQuery.alignmentPeriod,
          perSeriesAligner: metricQuery.perSeriesAligner,
          groupBys: metricQuery.groupBys,
          filters: metricQuery.filters,
          view: metricQuery.view,
          preprocessor: metricQuery.preprocessor,
        };
        query.queryType = QueryType.TIME_SERIES_LIST;
        if (metricQuery.metricType) {
          query.timeSeriesList.filters = this.migrateMetricTypeFilter(
            metricQuery.metricType,
            query.timeSeriesList.filters
          );
        }
      }
      query.aliasBy = metricQuery.aliasBy;
      query = omit(query, 'metricQuery');
    }

    if (query.queryType === QueryType.SLO && has(query, 'sloQuery.aliasBy')) {
      const sloQuery = get(query, 'sloQuery.aliasBy');
      if (typeof sloQuery === 'string') {
        query.aliasBy = sloQuery;
      }
      query = omit(query, 'sloQuery.aliasBy');
    }

    return query;
  }

  interpolatePromQLQuery(value: string | string[], _variable: QueryVariableModel) {
    if (isArray(value)) {
      return value.join('|');
    }
    return value;
  }

  interpolateProps<T extends Record<string, any>>(
    object: T,
    scopedVars: ScopedVars = {},
    formattingFunctions?: { [key: string]: Function | undefined }
  ): T {
    return Object.entries(object).reduce((acc, [key, value]) => {
      let interpolatedValue = value;
      if (value && isString(value)) {
        // Pass a function to the template service for formatting
        interpolatedValue = this.templateSrv.replace(
          value,
          scopedVars,
          formattingFunctions && formattingFunctions[key]
        );
      }
      return {
        ...acc,
        [key]: interpolatedValue,
      };
    }, {} as T);
  }

  filterQuery(item: CloudMonitoringQuery): boolean {
    if (item.hide) {
      return false;
    }

    const query = this.migrateQuery(item);

    if (query.queryType === QueryType.SLO) {
      if (!query.sloQuery) {
        return false;
      }
      const { selectorName, serviceId, sloId, projectName, lookbackPeriod } = query.sloQuery;
      return (
        !!selectorName &&
        !!serviceId &&
        !!sloId &&
        !!projectName &&
        (selectorName !== SLO_BURN_RATE_SELECTOR_NAME || !!lookbackPeriod)
      );
    }

    if (query.queryType === QueryType.TIME_SERIES_QUERY) {
      return !!query.timeSeriesQuery && !!query.timeSeriesQuery.projectName && !!query.timeSeriesQuery.query;
    }

    if (query.queryType && [QueryType.TIME_SERIES_LIST, QueryType.ANNOTATION].includes(query.queryType)) {
      return !!query.timeSeriesList && !!query.timeSeriesList.projectName && !!getMetricType(query.timeSeriesList);
    }

    if (query.queryType === QueryType.PROMQL) {
      return (
        !!query.promQLQuery && !!query.promQLQuery.projectName && !!query.promQLQuery.expr && !!query.promQLQuery.step
      );
    }

    return false;
  }

  interpolateVariablesInQueries(queries: CloudMonitoringQuery[], scopedVars: ScopedVars): CloudMonitoringQuery[] {
    return queries.map((query) => this.applyTemplateVariables(this.migrateQuery(query), scopedVars));
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
