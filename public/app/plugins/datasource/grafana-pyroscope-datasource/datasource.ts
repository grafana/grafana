import Prism, { Grammar } from 'prismjs';
import { Observable, of } from 'rxjs';

import {
  AbstractQuery,
  CoreApp,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  ScopedVars,
} from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv, TemplateSrv } from '@grafana/runtime';

import { extractLabelMatchers, toPromLikeExpr } from '../prometheus/language_utils';

import { VariableSupport } from './VariableSupport';
import { defaultGrafanaPyroscope, defaultPyroscopeQueryType } from './dataquery.gen';
import { PyroscopeDataSourceOptions, Query, ProfileTypeMessage } from './types';

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
    return super.query({
      ...request,
      targets: validTargets,
    });
  }

  async getProfileTypes(): Promise<ProfileTypeMessage[]> {
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

  applyTemplateVariables(query: Query, scopedVars: ScopedVars): Query {
    return {
      ...query,
      labelSelector: this.templateSrv.replace(query.labelSelector ?? '', scopedVars),
      profileTypeId: this.templateSrv.replace(query.profileTypeId ?? '', scopedVars),
    };
  }

  async importFromAbstractQueries(abstractQueries: AbstractQuery[]): Promise<Query[]> {
    return abstractQueries.map((abstractQuery) => this.importFromAbstractQuery(abstractQuery));
  }

  importFromAbstractQuery(labelBasedQuery: AbstractQuery): Query {
    return {
      refId: labelBasedQuery.refId,
      labelSelector: toPromLikeExpr(labelBasedQuery),
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
  ...defaultGrafanaPyroscope,
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

const grammar: Grammar = {
  'context-labels': {
    pattern: /\{[^}]*(?=}?)/,
    greedy: true,
    inside: {
      comment: {
        pattern: /#.*/,
      },
      'label-key': {
        pattern: /[a-zA-Z_]\w*(?=\s*(=|!=|=~|!~))/,
        alias: 'attr-name',
        greedy: true,
      },
      'label-value': {
        pattern: /"(?:\\.|[^\\"])*"/,
        greedy: true,
        alias: 'attr-value',
      },
      punctuation: /[{]/,
    },
  },
  punctuation: /[{}(),.]/,
};
