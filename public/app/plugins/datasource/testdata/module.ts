import { DataSourcePlugin } from '@grafana/ui';
import { TestDataDatasource } from './datasource';
import { TestDataQueryCtrl } from './query_ctrl';

class TestDataAnnotationsQueryCtrl {
  annotation: any;
  constructor() {}
  static template = '<h2>Annotation scenario</h2>';
}

export const plugin = new DataSourcePlugin(TestDataDatasource)
  .setQueryCtrl(TestDataQueryCtrl)
  .setAnnotationQueryCtrl(TestDataAnnotationsQueryCtrl);
