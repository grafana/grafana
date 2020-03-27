import { DataSourcePlugin } from '@grafana/data';
import StackdriverDatasource from './datasource';
import { QueryEditor } from './components/QueryEditor';
import { StackdriverConfigCtrl } from './config_ctrl';
import { StackdriverAnnotationsQueryCtrl } from './annotations_query_ctrl';
import { StackdriverVariableQueryEditor } from './components/VariableQueryEditor';
import { StackdriverQuery } from './types';

export const plugin = new DataSourcePlugin<StackdriverDatasource, StackdriverQuery>(StackdriverDatasource)
  .setQueryEditor(QueryEditor)
  .setConfigCtrl(StackdriverConfigCtrl)
  .setAnnotationQueryCtrl(StackdriverAnnotationsQueryCtrl)
  .setVariableQueryEditor(StackdriverVariableQueryEditor);
