import { AbstractLabelOperator, AbstractLabelMatcher, LanguageProvider, AbstractQuery } from '@grafana/data';

import { ElasticDatasource } from './datasource';
import { ElasticsearchQuery } from './types';

export default class ElasticsearchLanguageProvider extends LanguageProvider {
  declare request: (url: string, params?: any) => Promise<any>;
  declare start: () => Promise<any[]>;
  datasource: ElasticDatasource;

  constructor(datasource: ElasticDatasource, initialValues?: any) {
    super();
    this.datasource = datasource;

    Object.assign(this, initialValues);
  }

  /**
   * Queries are transformed to an ES Logs query since it's the behaviour most users expect.
   **/
  importFromAbstractQuery(abstractQuery: AbstractQuery): ElasticsearchQuery {
    return {
      metrics: [
        {
          id: '1',
          type: 'logs',
        },
      ],
      query: this.getElasticsearchQuery(abstractQuery.labelMatchers),
      refId: abstractQuery.refId,
    };
  }

  getElasticsearchQuery(labels: AbstractLabelMatcher[]): string {
    return labels
      .map((label) => {
        switch (label.operator) {
          case AbstractLabelOperator.Equal: {
            return label.name + ':"' + label.value + '"';
          }
          case AbstractLabelOperator.NotEqual: {
            return '-' + label.name + ':"' + label.value + '"';
          }
          case AbstractLabelOperator.EqualRegEx: {
            return label.name + ':/' + label.value + '/';
          }
          case AbstractLabelOperator.NotEqualRegEx: {
            return '-' + label.name + ':/' + label.value + '/';
          }
        }
      })
      .join(' AND ');
  }
}
