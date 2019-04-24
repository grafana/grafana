import InfluxDatasource from './datasource';
import { InfluxQueryCtrl } from './query_ctrl';
import {
  createChangeHandler,
  createResetHandler,
  PasswordFieldEnum,
} from '../../../features/datasources/utils/passwordHandlers';

class InfluxConfigCtrl {
  static templateUrl = 'partials/config.html';
  current: any;
  onPasswordReset: ReturnType<typeof createResetHandler>;
  onPasswordChange: ReturnType<typeof createChangeHandler>;

  constructor() {
    this.onPasswordReset = createResetHandler(this, PasswordFieldEnum.Password);
    this.onPasswordChange = createChangeHandler(this, PasswordFieldEnum.Password);
  }
}

class InfluxAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
}

export {
  InfluxDatasource as Datasource,
  InfluxQueryCtrl as QueryCtrl,
  InfluxConfigCtrl as ConfigCtrl,
  InfluxAnnotationsQueryCtrl as AnnotationsQueryCtrl,
};
