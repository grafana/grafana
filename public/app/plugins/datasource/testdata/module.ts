import { TestDataDatasource } from './datasource';
import { TestDataQueryCtrl } from './query_ctrl';
// import { QueryEditor } from './QueryEditor';

class TestDataAnnotationsQueryCtrl {
  annotation: any;

  constructor() {}

  static template = '<h2>Annotation scenario</h2>';
}

export {
  // QueryEditor,
  TestDataDatasource as Datasource,
  TestDataQueryCtrl as QueryCtrl,
  TestDataAnnotationsQueryCtrl as AnnotationsQueryCtrl,
};
