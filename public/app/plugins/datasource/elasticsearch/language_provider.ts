import { LabelComparator, LabelSelector, LanguageProvider } from '@grafana/data';

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

  getElasticsearchQuery(labels: LabelSelector[]): string {
    return labels
      .map((label) => {
        switch (label.labelComparator) {
          case LabelComparator.Equal: {
            return label.labelName + ':"' + label.labelValue + '"';
          }
          case LabelComparator.NotEqual: {
            return 'NOT ' + label.labelName + ':"' + label.labelValue + '"';
          }
          case LabelComparator.EqualRegEx: {
            return label.labelName + ':/' + label.labelValue + '/';
          }
          case LabelComparator.NotEqualRegEx: {
            return 'NOT ' + label.labelName + ':/' + label.labelValue + '/';
          }
        }
      })
      .join(' AND ');
  }
}
