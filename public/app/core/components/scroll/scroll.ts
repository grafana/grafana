import PerfectScrollbar from 'perfect-scrollbar';
import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';

export function geminiScrollbar() {
  return {
    restrict: 'A',
    link: function(scope, elem, attrs) {
      let scrollbar = new PerfectScrollbar(elem[0], {
        wheelPropagation: true,
        wheelSpeed: 3,
      });
      let lastPos = 0;

      appEvents.on(
        'dash-scroll',
        evt => {
          if (evt.restore) {
            elem[0].scrollTop = lastPos;
            return;
          }

          lastPos = elem[0].scrollTop;

          if (evt.animate) {
            elem.animate({ scrollTop: evt.pos }, 500);
          } else {
            elem[0].scrollTop = evt.pos;
          }
        },
        scope
      );

      scope.$on('$routeChangeSuccess', () => {
        lastPos = 0;
        elem[0].scrollTop = 0;
      });

      scope.$on('$destroy', () => {
        scrollbar.destroy();
      });
    },
  };
}

coreModule.directive('grafanaScrollbar', geminiScrollbar);
