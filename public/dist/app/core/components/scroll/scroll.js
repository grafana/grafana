import $ from 'jquery';
import baron from 'baron';
import coreModule from 'app/core/core_module';
var scrollBarHTML = "\n<div class=\"baron__track\">\n  <div class=\"baron__bar\"></div>\n</div>\n";
var scrollRootClass = 'baron baron__root';
var scrollerClass = 'baron__scroller';
export function geminiScrollbar() {
    return {
        restrict: 'A',
        link: function (scope, elem, attrs) {
            var scrollRoot = elem.parent();
            var scroller = elem;
            console.log('scroll');
            if (attrs.grafanaScrollbar && attrs.grafanaScrollbar === 'scrollonroot') {
                scrollRoot = scroller;
            }
            scrollRoot.addClass(scrollRootClass);
            $(scrollBarHTML).appendTo(scrollRoot);
            elem.addClass(scrollerClass);
            var scrollParams = {
                root: scrollRoot[0],
                scroller: scroller[0],
                bar: '.baron__bar',
                barOnCls: '_scrollbar',
                scrollingCls: '_scrolling',
                track: '.baron__track',
                direction: 'v',
            };
            var scrollbar = baron(scrollParams);
            scope.$on('$destroy', function () {
                scrollbar.dispose();
            });
        },
    };
}
coreModule.directive('grafanaScrollbar', geminiScrollbar);
//# sourceMappingURL=scroll.js.map