import config from 'app/core/config';
import { getBackendSrv } from '@grafana/runtime';
import { NavModelSrv } from 'app/core/core';

export default class StyleGuideCtrl {
  theme: string;
  buttonNames = ['primary', 'secondary', 'inverse', 'success', 'warning', 'danger'];
  buttonSizes = ['btn-small', '', 'btn-large'];
  buttonVariants = ['-'];
  navModel: any;

  /** @ngInject */
  constructor(private $routeParams: any, navModelSrv: NavModelSrv) {
    this.navModel = navModelSrv.getNav('admin', 'styleguide', 0);
    this.theme = config.bootData.user.lightTheme ? 'light' : 'dark';
  }

  switchTheme() {
    this.$routeParams.theme = this.theme === 'dark' ? 'light' : 'dark';

    const cmd = {
      theme: this.$routeParams.theme,
    };

    getBackendSrv()
      .put('/api/user/preferences', cmd)
      .then(() => {
        window.location.href = window.location.href;
      });
  }
}
