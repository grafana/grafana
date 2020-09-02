import { AnnotationQueryRequest } from '@grafana/data';
import { InfluxQuery } from './types';

export class InfluxAnnotationsQueryCtrl {
  // @ts-ignore
  annotation: AnnotationQueryRequest<InfluxQuery>;

  // @ts-ignore
  private datasource?: DataSource;

  static templateUrl = 'partials/annotations.editor.html';

  /** @ngInject */
  constructor() {
    // @ts-ignore
    // this.annotation.annotation = {}; //defaultsDeep(this.annotation.annotation, defaultQuery);
    // @ts-ignore
    //this.annotation.datasourceId = this.datasource.id;
  }

  onChange = (query: AnnotationQueryRequest<InfluxQuery>) => {
    this.annotation.annotation = query.annotation;
  };
}
