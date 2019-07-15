import appEvents from 'app/core/app_events';
import config from 'app/core/config';
import { ILocationService } from 'angular';

export class LoginCtrl {
  result: any = {};
  /** @ngInject */
  constructor(private $location: ILocationService) {}
  init() {
    if (config.loginError) {
      appEvents.on('alert-warning', ['Login Failed', config.loginError]);
    }
  }
  signUp() {}

  login() {}

  skip() {}

  changeView() {}

  submit(loginMode = true) {
    if (loginMode) {
      this.login();
    } else {
      this.signUp();
    }
  }

  toGrafana() {
    const params = this.$location.search();

    if (params.redirect && params.redirect[0] === '/') {
      window.location.href = config.appSubUrl + params.redirect;
    } else if (this.result.redirectUrl) {
      window.location.href = this.result.redirectUrl;
    } else {
      window.location.href = config.appSubUrl + '/';
    }
  }
}
