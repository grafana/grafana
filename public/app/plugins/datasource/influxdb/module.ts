import InfluxDatasource from './datasource';
import { InfluxQueryCtrl } from './query_ctrl';
import { InfluxLogsQueryField } from './components/InfluxLogsQueryField';
import InfluxStartPage from './components/InfluxStartPage';

import {
  createChangeHandler,
  createResetHandler,
  PasswordFieldEnum,
} from '../../../features/datasources/utils/passwordHandlers';
import { DataSourcePlugin } from '@grafana/data';

class InfluxConfigCtrl {
  static templateUrl = 'partials/config.html';
  current: any;
  onPasswordReset: ReturnType<typeof createResetHandler>;
  onPasswordChange: ReturnType<typeof createChangeHandler>;

  constructor() {
    this.onPasswordReset = createResetHandler(this, PasswordFieldEnum.Password);
    this.onPasswordChange = createChangeHandler(this, PasswordFieldEnum.Password);
    this.current.jsonData.httpMode = this.current.jsonData.httpMode || 'GET';
  }

  httpMode = [{ name: 'GET', value: 'GET' }, { name: 'POST', value: 'POST' }];
}

class InfluxAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export const plugin = new DataSourcePlugin(InfluxDatasource)
  .setConfigCtrl(InfluxConfigCtrl)
  .setQueryCtrl(InfluxQueryCtrl)
  .setAnnotationQueryCtrl(InfluxAnnotationsQueryCtrl)
  .setExploreLogsQueryField(InfluxLogsQueryField)
  .setExploreStartPage(InfluxStartPage);
