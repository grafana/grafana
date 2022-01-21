import { DataSourcePlugin } from '@grafana/data';
import { TestDataDataSource } from './datasource';
import { TestInfoTab } from './TestInfoTab';
import { ConfigEditor } from './ConfigEditor';
import { QueryEditor } from './QueryEditor';

class TestDataAnnotationsQueryCtrl {
  annotation: any;
  constructor() {}
  static template = '<h2>Annotation scenario</h2>';
}

export const plugin = new DataSourcePlugin(TestDataDataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor)
  .setAnnotationQueryCtrl(TestDataAnnotationsQueryCtrl)
  .addConfigPage({
    title: 'Setup',
    icon: 'list-ul',
    body: TestInfoTab,
    id: 'setup',
  });
