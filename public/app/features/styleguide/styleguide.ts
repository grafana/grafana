
import coreModule from 'app/core/core_module';
import config from 'app/core/config';

class StyleGuideCtrl {

  switchTheme() {
    var other = config.bootData.user.lightTheme ? 'dark' : 'light';
    window.location.href = config.appSubUrl + '/styleguide?theme=' + other;
  }

}

coreModule.controller('StyleGuideCtrl', StyleGuideCtrl);
