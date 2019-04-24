import {
  createChangeHandler,
  createResetHandler,
  PasswordFieldEnum,
} from '../../../features/datasources/utils/passwordHandlers';

export class MssqlConfigCtrl {
  static templateUrl = 'partials/config.html';

  current: any;
  onPasswordReset: ReturnType<typeof createResetHandler>;
  onPasswordChange: ReturnType<typeof createChangeHandler>;

  /** @ngInject */
  constructor($scope) {
    this.current.jsonData.encrypt = this.current.jsonData.encrypt || 'false';
    this.onPasswordReset = createResetHandler(this, PasswordFieldEnum.Password);
    this.onPasswordChange = createChangeHandler(this, PasswordFieldEnum.Password);
  }
}
