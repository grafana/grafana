
import coreModule from 'app/core/core_module';
import config from 'app/core/config';
import _ from 'lodash';

class StyleGuideCtrl {
  colors: any = [];
  theme: string;

  /** @ngInject **/
  constructor($http) {
    this.theme = config.bootData.user.lightTheme ? 'light': 'dark';

    $http.get('public/sass/styleguide.json').then(res => {
      this.colors = _.map(res.data[this.theme], (value, key) => {
        return {name: key, value: value};
      });
    });
  }

  switchTheme() {
    var other = this.theme === 'dark' ? 'light' : 'dark';
    window.location.href = config.appSubUrl + '/styleguide?theme=' + other;
  }

}

coreModule.controller('StyleGuideCtrl', StyleGuideCtrl);
