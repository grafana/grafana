
import coreModule from 'app/core/core_module';
import config from 'app/core/config';
import _ from 'lodash';

class StyleGuideCtrl {
  colors: any = [];
  theme: string;
  buttonNames = ['primary', 'secondary', 'inverse', 'success', 'warning', 'danger'];
  buttonSizes = ['btn-small', '', 'btn-large'];
  buttonVariants = ['-', '-outline-'];
  page: any;
  pages = ['colors', 'buttons'];

  /** @ngInject **/
  constructor(private $http, $routeParams) {
    this.theme = config.bootData.user.lightTheme ? 'light': 'dark';
    this.page = {};

    if ($routeParams.page) {
      this.page[$routeParams.page] = 1;
    } else {
      this.page.colors = true;
    }

    if (this.page.colors) {
      this.loadColors();
    }
   }

  loadColors() {
   this.$http.get('public/sass/styleguide.json').then(res => {
      this.colors = _.map(res.data[this.theme], (value, key) => {
        return {name: key, value: value};
      });
    });
  }

  switchTheme() {
    var other = this.theme === 'dark' ? 'light' : 'dark';
    window.location.href = window.location.href + '?theme=' + other;
  }

}

coreModule.controller('StyleGuideCtrl', StyleGuideCtrl);
