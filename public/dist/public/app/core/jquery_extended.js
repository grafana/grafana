import $ from 'jquery';
import angular from 'angular';
import { extend } from 'lodash';
var $win = $(window);
$.fn.place_tt = (function () {
    var defaults = {
        offset: 5,
    };
    return function (x, y, opts) {
        var _this = this;
        opts = $.extend(true, {}, defaults, opts);
        return this.each(function () {
            var $tooltip = $(_this);
            var width, height;
            $tooltip.addClass('grafana-tooltip');
            $('#tooltip').remove();
            $tooltip.appendTo(document.body);
            if (opts.compile) {
                angular
                    .element(document)
                    .injector()
                    .invoke([
                    '$compile',
                    '$rootScope',
                    function ($compile, $rootScope) {
                        var tmpScope = $rootScope.$new(true);
                        extend(tmpScope, opts.scopeData);
                        $compile($tooltip)(tmpScope);
                        tmpScope.$digest();
                        tmpScope.$destroy();
                    },
                ]);
            }
            width = $tooltip.outerWidth(true);
            height = $tooltip.outerHeight(true);
            var left = x + opts.offset + width > $win.width() ? x - opts.offset - width : x + opts.offset;
            var top = y + opts.offset + height > $win.height() ? y - opts.offset - height : y + opts.offset;
            $tooltip.css('left', left > 0 ? left : 0);
            $tooltip.css('top', top > 0 ? top : 0);
        });
    };
})();
//# sourceMappingURL=jquery_extended.js.map