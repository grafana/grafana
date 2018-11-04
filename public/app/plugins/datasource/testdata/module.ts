import { TestDataDatasource } from './datasource';
import { TestDataQueryCtrl } from './query_ctrl';

class TestDataAnnotationsQueryCtrl {
  annotation: any;

  constructor() {}

  static template = '<h2>Annotation scenario</h2>';
}

export {
  TestDataDatasource,
  TestDataDatasource as Datasource,
  TestDataQueryCtrl as QueryCtrl,
  TestDataAnnotationsQueryCtrl as AnnotationsQueryCtrl,
};
