import Prism, { Grammar } from 'prismjs';
import { Observable, of } from 'rxjs';

import {
  AbstractQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  ScopedVars,
} from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv, TemplateSrv } from '@grafana/runtime';

import { extractLabelMatchers, toPromLikeExpr } from '../prometheus/language_utils';

import { normalizeQuery } from './QueryEditor/QueryEditor';
import { PhlareDataSourceOptions, Query, ProfileTypeMessage, SeriesMessage } from './types';

export class PhlareDataSource extends DataSourceWithBackend<Query, PhlareDataSourceOptions> {
  constructor(
    instanceSettings: DataSourceInstanceSettings<PhlareDataSourceOptions>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
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
    return await super.getResource('profileTypes');
  }

  async getSeries(): Promise<SeriesMessage> {
    // For now, we send empty matcher to get all the series
    return await super.getResource('series', { matchers: ['{}'] });
  }

  async getLabelNames(): Promise<string[]> {
    return await super.getResource('labelNames');
  }

  applyTemplateVariables(query: Query, scopedVars: ScopedVars): Query {
    return {
      ...query,
      labelSelector: this.templateSrv.replace(query.labelSelector ?? '', scopedVars),
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
      groupBy: [''],
    };
  }

  async exportToAbstractQueries(queries: Query[]): Promise<AbstractQuery[]> {
    return queries.map((query) => this.exportToAbstractQuery(query));
  }

  exportToAbstractQuery(query: Query): AbstractQuery {
    const phlareQuery = query.labelSelector;
    if (!phlareQuery || phlareQuery.length === 0) {
      return { refId: query.refId, labelMatchers: [] };
    }
    const tokens = Prism.tokenize(phlareQuery, grammar);
    return {
      refId: query.refId,
      labelMatchers: extractLabelMatchers(tokens),
    };
  }
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
