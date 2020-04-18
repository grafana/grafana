import { ElasticsearchQuery } from './types';
import { DataQuery, LanguageProvider } from '@grafana/data';

import { ElasticDatasource } from './datasource';

import { PromQuery } from '../prometheus/types';

const labelRegexp = /(\w+)\s*(=|!=|=~|!~)\s*("[^"]*")/g;

async function getNameLabelValue(promQuery: string) {
  const openBracketIndex = promQuery.indexOf('{');
  const lastOpenParenthesis = promQuery.lastIndexOf('(');
  var startNameLabelIndex = 0;
  if (lastOpenParenthesis !== -1) {
    startNameLabelIndex = lastOpenParenthesis + 1;
  }
  let lastNameLabelIndex = openBracketIndex;
  if (openBracketIndex === -1) {
    const openBraceIndex = promQuery.indexOf('[');
    if (openBraceIndex === -1) {
      lastNameLabelIndex = promQuery.length;
    } else {
      lastNameLabelIndex = openBraceIndex;
    }
  }
  let nameLabelValue = promQuery.substring(startNameLabelIndex, lastNameLabelIndex);
  return nameLabelValue;
}
async function extractPrometheusLabels(promQuery: string): Promise<string[][]> {
  var labels: string[][] = [];
  if (!promQuery || promQuery.length === 0) {
    return labels;
  }
  const nameLabelValue = await getNameLabelValue(promQuery);
  if (nameLabelValue && nameLabelValue.length > 0) {
    labels.push(['__name__', '=', '"' + nameLabelValue + '"']);
  }

  let m;
  while ((m = labelRegexp.exec(promQuery)) != null) {
    labels.push([m[1], m[2], m[3]]);
  }
  return labels;
}
async function getElasticsearchQuery(prometheusLabels: string[][]): Promise<string> {
  var elasticsearchLuceneLabels = [];
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

  async importQueries(queries: DataQuery[], datasourceType: string): Promise<ElasticsearchQuery[]> {
    if (datasourceType === 'prometheus' || datasourceType === 'loki') {
      return Promise.all(
        queries.map(async query => {
          let prometheusQuery: PromQuery = query as PromQuery;
          const expr = await getElasticsearchQuery(await extractPrometheusLabels(prometheusQuery.expr));
          return {
            isLogsQuery: true,
            query: expr,
            refId: query.refId,
          };
        })
      );
    }
    return Promise.all(
      queries.map(async query => {
        return {
          isLogsQuery: true,
          query: '',
          refId: query.refId,
        };
      })
    );
  }
}
