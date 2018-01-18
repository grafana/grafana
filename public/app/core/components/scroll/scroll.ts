import PerfectScrollbar from 'perfect-scrollbar';
import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';

export function geminiScrollbar() {
  return {
    restrict: 'A',
    link: function(scope, elem, attrs) {
      let scrollbar = new PerfectScrollbar(elem[0]);

      appEvents.on(
        'smooth-scroll-top',
        () => {
          elem.animate(
            {
              scrollTop: 0,
            },
            500
          );
        },
        scope
      );

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
