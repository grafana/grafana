import StreamingDatasource from './datasource';
import { StreamingQueryEditor } from './StreamingQueryEditor';
import { StreamingConfigCtrl } from './config_ctrl';
import { DataSourcePlugin } from '@grafana/ui';

export const plugin = new DataSourcePlugin(StreamingDatasource)
  .setConfigCtrl(StreamingConfigCtrl)
  .setQueryEditor(StreamingQueryEditor);
