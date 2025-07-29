import Prism from 'prismjs';
import { map, Observable, of } from 'rxjs';

import {
  AbstractQuery,
  AdHocVariableFilter,
  CoreApp,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceGetTagKeysOptions,
  DataSourceGetTagValuesOptions,
  DataSourceInstanceSettings,
  MetricFindValue,
  ScopedVars,
} from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv, TemplateSrv } from '@grafana/runtime';

import { VariableSupport } from './VariableSupport';
import { defaultGrafanaPyroscopeDataQuery, defaultPyroscopeQueryType } from './dataquery.gen';
import { PyroscopeDataSourceOptions, Query, ProfileTypeMessage } from './types';
import {
  addLabelToQuery,
  extractLabelMatchers,
  grammar,
  toPromLikeExpr,
  enrichDataFrameWithQueryContextMapper,
} from './utils';

export class PyroscopeDataSource extends DataSourceWithBackend<Query, PyroscopeDataSourceOptions> {
  constructor(
    instanceSettings: DataSourceInstanceSettings<PyroscopeDataSourceOptions>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.variables = new VariableSupport(this);
  }

  query(request: DataQueryRequest<Query>): Observable<DataQueryResponse> {
    const validTargets = request.targets
      .filter((t) => t.profileTypeId)
      .map((t) => {
        // Empty string errors out but honestly seems like we can just normalize it this way
        if (t.labelSelector === '') {
          return {
            ...t,
            labelSelector: '{}',
          };
        }
        return normalizeQuery(t, request.app);
      });
    if (!validTargets.length) {
      return of({ data: [] });
    }
    return super
      .query({
        ...request,
        targets: validTargets,
      })
      .pipe(map(enrichDataFrameWithQueryContextMapper(request, this.name)));
  }

  async getProfileTypes(start: number, end: number): Promise<ProfileTypeMessage[]> {
    return await this.getResource('profileTypes', {
      start,
      end,
    });
  }

  async getAllProfileTypes(): Promise<ProfileTypeMessage[]> {
    return await this.getResource('profileTypes');
  }

  async getLabelNames(query: string, start: number, end: number): Promise<string[]> {
    return await this.getResource('labelNames', { query: this.templateSrv.replace(query), start, end });
  }

  async getLabelValues(query: string, label: string, start: number, end: number): Promise<string[]> {
    return await this.getResource('labelValues', {
      label: this.templateSrv.replace(label),
      query: this.templateSrv.replace(query),
      start,
      end,
    });
  }

  // By implementing getTagKeys and getTagValues we add ad-hoc filters functionality
  async getTagKeys(options: DataSourceGetTagKeysOptions<Query>): Promise<MetricFindValue[]> {
    const data = this.adhocFilterData(options);
    const labels = await this.getLabelNames(data.query, data.from, data.to);
    return labels.map((label) => ({ text: label }));
  }

  // By implementing getTagKeys and getTagValues we add ad-hoc filters functionality
  async getTagValues(options: DataSourceGetTagValuesOptions<Query>): Promise<MetricFindValue[]> {
    const data = this.adhocFilterData(options);
    const labels = await this.getLabelValues(data.query, options.key, data.from, data.to);
    return labels.map((label) => ({ text: label }));
  }

  private adhocFilterData(options: DataSourceGetTagKeysOptions<Query> | DataSourceGetTagValuesOptions<Query>) {
    const from = options.timeRange?.from.valueOf() ?? Date.now() - 1000 * 60 * 60 * 24;
    const to = options.timeRange?.to.valueOf() ?? Date.now();
    const query = '{' + options.filters.map((f) => `${f.key}${f.operator}"${f.value}"`).join(',') + '}';
    return { from, to, query };
  }

  applyTemplateVariables(query: Query, scopedVars: ScopedVars, filters?: AdHocVariableFilter[]): Query {
    let labelSelector = this.templateSrv.replace(query.labelSelector ?? '', scopedVars);
    if (filters && labelSelector) {
      for (const filter of filters) {
        labelSelector = addLabelToQuery(labelSelector, filter.key, filter.value, filter.operator);
      }
    }
    return {
      ...query,
      labelSelector,
      profileTypeId: this.templateSrv.replace(query.profileTypeId ?? '', scopedVars),
    };
  }

  async importFromAbstractQueries(abstractQueries: AbstractQuery[]): Promise<Query[]> {
    return abstractQueries.map((abstractQuery) => this.importFromAbstractQuery(abstractQuery));
  }

  importFromAbstractQuery(labelBasedQuery: AbstractQuery): Query {
    return {
      refId: labelBasedQuery.refId,
      labelSelector: toPromLikeExpr(labelBasedQuery.labelMatchers),
      queryType: 'both',
      profileTypeId: '',
      groupBy: [],
    };
  }

  async exportToAbstractQueries(queries: Query[]): Promise<AbstractQuery[]> {
    return queries.map((query) => this.exportToAbstractQuery(query));
  }

  exportToAbstractQuery(query: Query): AbstractQuery {
    const pyroscopeQuery = query.labelSelector;
    if (!pyroscopeQuery || pyroscopeQuery.length === 0) {
      return { refId: query.refId, labelMatchers: [] };
    }
    const tokens = Prism.tokenize(pyroscopeQuery, grammar);
    return {
      refId: query.refId,
      labelMatchers: extractLabelMatchers(tokens),
    };
  }

  getDefaultQuery(app: CoreApp): Partial<Query> {
    return defaultQuery;
  }
}

export const defaultQuery: Partial<Query> = {
  ...defaultGrafanaPyroscopeDataQuery,
  queryType: defaultPyroscopeQueryType,
};

export function normalizeQuery(query: Query, app?: CoreApp | string) {
  let normalized = { ...defaultQuery, ...query };
  if (app !== CoreApp.Explore && normalized.queryType === 'both') {
    // In dashboards and other places, we can't show both types of graphs at the same time.
    // This will also be a default when having 'both' query and adding it from explore to dashboard
    normalized.queryType = 'profile';
  }
  return normalized;
}
