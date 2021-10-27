import { AbstractLabelOperator, AbstractLabelMatcher, LanguageProvider } from '@grafana/data';

import { ElasticDatasource } from './datasource';

export default class ElasticsearchLanguageProvider extends LanguageProvider {
  declare request: (url: string, params?: any) => Promise<any>;
  declare start: () => Promise<any[]>;
  datasource: ElasticDatasource;

  constructor(datasource: ElasticDatasource, initialValues?: any) {
    super();
    this.datasource = datasource;

    Object.assign(this, initialValues);
  }

  getElasticsearchQuery(labels: AbstractLabelMatcher[]): string {
    return labels
      .map((label) => {
        switch (label.operator) {
          case AbstractLabelOperator.Equal: {
            return label.name + ':"' + label.value + '"';
          }
          case AbstractLabelOperator.NotEqual: {
            return 'NOT ' + label.name + ':"' + label.value + '"';
          }
          case AbstractLabelOperator.EqualRegEx: {
            return label.name + ':/' + label.value + '/';
          }
          case AbstractLabelOperator.NotEqualRegEx: {
            return 'NOT ' + label.name + ':/' + label.value + '/';
          }
        }
      })
      .join(' AND ');
  }
}
