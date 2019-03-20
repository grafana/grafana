import { SyntheticEvent } from 'react';

export class MssqlConfigCtrl {
  static templateUrl = 'partials/config.html';

  current: any;

  /** @ngInject */
  constructor($scope) {
    this.current.jsonData.encrypt = this.current.jsonData.encrypt || 'false';
  }

  onPasswordReset = (event: SyntheticEvent<HTMLInputElement>) => {
    event.preventDefault();
    this.current.secureJsonFields.password = false;
    this.current.secureJsonData = this.current.secureJsonData || {};
    this.current.secureJsonData.password = '';
  };

  onPasswordChange = (event: SyntheticEvent<HTMLInputElement>) => {
    this.current.secureJsonData = this.current.secureJsonData || {};
    this.current.secureJsonData.password = event.currentTarget.value;
  };
}
