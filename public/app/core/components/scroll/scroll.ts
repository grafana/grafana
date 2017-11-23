import PerfectScrollbar from 'perfect-scrollbar';
import coreModule from 'app/core/core_module';

export function geminiScrollbar() {
  return {
    restrict: 'A',
    link: function(scope, elem, attrs) {

      let scrollbar = new PerfectScrollbar(elem[0]);
      console.log('scrllbar!');

      scope.$on('$destroy', () => {
        scrollbar.destroy();
      });

    }
  };
}

coreModule.directive('grafanaScrollbar', geminiScrollbar);
