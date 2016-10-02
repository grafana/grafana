
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
  constructor(private $http, private $routeParams, private $location) {
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
    this.$routeParams.theme = this.theme === 'dark' ? 'light' : 'dark';
    this.$location.search(this.$routeParams);
    setTimeout(() => {
      window.location.href = window.location.href;
    });
  }

}

coreModule.controller('StyleGuideCtrl', StyleGuideCtrl);
