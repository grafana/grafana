import { InfluxAnnotation } from './types';

export class InfluxAnnotationsQueryCtrl {
  // @ts-ignore
  annotation: any;

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

  onChange = (anno: InfluxAnnotation) => {
    this.annotation = anno;
  };
}
