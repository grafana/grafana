import { DataSourcePlugin, StandardChannelHandler } from '@grafana/data';
import { TestDataDataSource } from './datasource';
import { TestDataQueryCtrl } from './query_ctrl';
import { TestInfoTab } from './TestInfoTab';
import { ConfigEditor } from './ConfigEditor';

class TestDataAnnotationsQueryCtrl {
  annotation: any;
  constructor() {}
  static template = '<h2>Annotation scenario</h2>';
}

export const plugin = new DataSourcePlugin(TestDataDataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryCtrl(TestDataQueryCtrl)
  .setAnnotationQueryCtrl(TestDataAnnotationsQueryCtrl)
  .setLiveSupport({
    getChannelHandler: (path: string) => {
      if (path === 'random-2s-stream') {
        return StandardChannelHandler;
      }
      if (path === 'random-flakey-stream') {
        return StandardChannelHandler;
      }
      return null; // not supported
    },
  })
  .addConfigPage({
    title: 'Setup',
    icon: 'list-ul',
    body: TestInfoTab,
    id: 'setup',
  });
