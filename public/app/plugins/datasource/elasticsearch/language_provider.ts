import { ElasticsearchQuery } from './types';
import { DataQuery, LanguageProvider } from '@grafana/data';

import { ElasticDatasource } from './datasource';

import { PromQuery } from '../prometheus/types';

import Prism, { Token } from 'prismjs';
import grammar from '../prometheus/promql';

function getNameLabelValue(promQuery: string, tokens: any): string {
  let nameLabelValue = '';
  for (let prop in tokens) {
    if (typeof tokens[prop] === 'string') {
      nameLabelValue = tokens[prop] as string;
      break;
    }
  }
  return nameLabelValue;
}

function extractPrometheusLabels(promQuery: string): string[][] {
  const labels: string[][] = [];
  if (!promQuery || promQuery.length === 0) {
    return labels;
  }
  const tokens = Prism.tokenize(promQuery, grammar);
  const nameLabelValue = getNameLabelValue(promQuery, tokens);
  if (nameLabelValue && nameLabelValue.length > 0) {
    labels.push(['__name__', '=', '"' + nameLabelValue + '"']);
  }

  for (let prop in tokens) {
    if (tokens[prop] instanceof Token) {
      let token: Token = tokens[prop] as Token;
      if (token.type === 'context-labels') {
        let labelKey = '';
        let labelValue = '';
        let labelOperator = '';
        let contentTokens: any[] = token.content as any[];
        for (let currentToken in contentTokens) {
          if (typeof contentTokens[currentToken] === 'string') {
            let currentStr: string;
            currentStr = contentTokens[currentToken] as string;
            if (currentStr === '=' || currentStr === '!=' || currentStr === '=~' || currentStr === '!~') {
              labelOperator = currentStr;
            }
          } else if (contentTokens[currentToken] instanceof Token) {
            switch (contentTokens[currentToken].type) {
              case 'label-key':
                labelKey = contentTokens[currentToken].content as string;
                break;
              case 'label-value':
                labelValue = contentTokens[currentToken].content as string;
                labels.push([labelKey, labelOperator, labelValue]);
                break;
            }
          }
        }
      }
    }
  }
  return labels;
}

function getElasticsearchQuery(prometheusLabels: string[][]): string {
  let elasticsearchLuceneLabels = [];
  for (let keyOperatorValue of prometheusLabels) {
    switch (keyOperatorValue[1]) {
      case '=': {
        elasticsearchLuceneLabels.push(keyOperatorValue[0] + ':' + keyOperatorValue[2]);
        break;
      }
      case '!=': {
        elasticsearchLuceneLabels.push('NOT ' + keyOperatorValue[0] + ':' + keyOperatorValue[2]);
        break;
      }
      case '=~': {
        elasticsearchLuceneLabels.push(
          keyOperatorValue[0] + ':/' + keyOperatorValue[2].substring(1, keyOperatorValue[2].length - 1) + '/'
        );
        break;
      }
      case '!~': {
        elasticsearchLuceneLabels.push(
          'NOT ' + keyOperatorValue[0] + ':/' + keyOperatorValue[2].substring(1, keyOperatorValue[2].length - 1) + '/'
        );
        break;
      }
    }
  }
  return elasticsearchLuceneLabels.join(' AND ');
}

export default class ElasticsearchLanguageProvider extends LanguageProvider {
  request: (url: string, params?: any) => Promise<any>;
  start: () => Promise<any[]>;
  datasource: ElasticDatasource;

  constructor(datasource: ElasticDatasource, initialValues?: any) {
    super();
    this.datasource = datasource;

    Object.assign(this, initialValues);
  }

  importQueries(queries: DataQuery[], datasourceType: string): ElasticsearchQuery[] {
    if (datasourceType === 'prometheus' || datasourceType === 'loki') {
      return queries.map(query => {
        let prometheusQuery: PromQuery = query as PromQuery;
        const expr = getElasticsearchQuery(extractPrometheusLabels(prometheusQuery.expr));
        return {
          isLogsQuery: true,
          query: expr,
          refId: query.refId,
        };
      });
    }
    return queries.map(query => {
      return {
        isLogsQuery: true,
        query: '',
        refId: query.refId,
      };
    });
  }
}
