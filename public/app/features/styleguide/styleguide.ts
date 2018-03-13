import coreModule from 'app/core/core_module';
import config from 'app/core/config';

class StyleGuideCtrl {
  theme: string;
  buttonNames = ['primary', 'secondary', 'inverse', 'success', 'warning', 'danger'];
  buttonSizes = ['btn-small', '', 'btn-large'];
  buttonVariants = ['-'];
  navModel: any;

  /** @ngInject **/
  constructor(private $routeParams, private backendSrv, navModelSrv) {
    this.navModel = navModelSrv.getNav('cfg', 'admin', 'styleguide', 1);
    this.theme = config.bootData.user.lightTheme ? 'light' : 'dark';
  }

  switchTheme() {
    this.$routeParams.theme = this.theme === 'dark' ? 'light' : 'dark';

    var cmd = {
      theme: this.$routeParams.theme,
    };

    this.backendSrv.put('/api/user/preferences', cmd).then(() => {
      window.location.href = window.location.href;
    });
  }
}

coreModule.controller('StyleGuideCtrl', StyleGuideCtrl);
