import { DataSourcePlugin } from '@grafana/ui';
import { TestDataDatasource } from './datasource';
import { TestDataQueryCtrl } from './query_ctrl';
import { TestInfoTab } from './TestInfoTab';

class TestDataAnnotationsQueryCtrl {
  annotation: any;
  constructor() {}
  static template = '<h2>Annotation scenario</h2>';
}

export const plugin = new DataSourcePlugin(TestDataDatasource)
  .setQueryCtrl(TestDataQueryCtrl)
  .setAnnotationQueryCtrl(TestDataAnnotationsQueryCtrl)
  .addConfigTab({
    title: 'Setup',
    icon: 'fa fa-list-alt',
    body: TestInfoTab,
    id: 'setup',
  });
