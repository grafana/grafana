import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';

export function pageScrollbar() {
  return {
    restrict: 'A',
    link: function(scope, elem, attrs) {
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
        // Focus page to enable scrolling by keyboard
        elem[0].focus({ preventScroll: true });
      });

      elem[0].tabIndex = -1;
      // Focus page to enable scrolling by keyboard
      elem[0].focus({ preventScroll: true });
    },
  };
}

coreModule.directive('pageScrollbar', pageScrollbar);
