import PerfectScrollbar from 'perfect-scrollbar';
import coreModule from 'app/core/core_module';

export function geminiScrollbar() {
  return {
    restrict: 'A',
    link: function(scope, elem, attrs) {
      let scrollbar = new PerfectScrollbar(elem[0]);

      scope.$on('$routeChangeSuccess', () => {
        elem[0].scrollTop = 0;
      });

      scope.$on('$routeUpdate', () => {
        elem[0].scrollTop = 0;
      });

      scope.$on('$destroy', () => {
        scrollbar.destroy();
      });
    },
  };
}

coreModule.directive('grafanaScrollbar', geminiScrollbar);
