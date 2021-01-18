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
  showUserCredentials: boolean;

  /** @ngInject */
  constructor($scope: any) {
    this.current.jsonData.encrypt = this.current.jsonData.encrypt || 'false';
    this.current.jsonData.authenticationType = this.current.jsonData.authenticationType || 'SQL Server Authentication';
    this.onPasswordReset = createResetHandler(this, PasswordFieldEnum.Password);
    this.onPasswordChange = createChangeHandler(this, PasswordFieldEnum.Password);
    this.showUserCredentials = this.current.jsonData.authenticationType !== 'Windows Authentication';
  }

  onAuthenticationTypeChange() {
    // Workaround to reset the user value in the database and xorm ignoring empty strings. Needs to be an empty string for the Windows auth to work.
    // This is using the fallback in https://github.com/denisenkom/go-mssqldb to use Windows Auth if login/user id is empty.
    if (this.current.jsonData.authenticationType === 'Windows Authentication') {
      this.current.user = ' ';
    } else {
      this.current.user = '';
    }

    this.showUserCredentials = this.current.jsonData.authenticationType !== 'Windows Authentication';
  }
}
