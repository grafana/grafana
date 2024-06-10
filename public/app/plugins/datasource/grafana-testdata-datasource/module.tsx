import { DataSourcePlugin } from '@grafana/data';

import { ConfigEditor } from './ConfigEditor';
import { MetaDataInspector } from './MetaDataInspector';
import { QueryEditor } from './QueryEditor';
import { TestInfoTab } from './TestInfoTab';
import { TestDataDataSource } from './datasource';

export const plugin = new DataSourcePlugin(TestDataDataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor)
  .setMetadataInspector(MetaDataInspector)
  .addConfigPage({
    title: 'Setup',
    icon: 'list-ul',
    body: TestInfoTab,
    id: 'setup',
  });
