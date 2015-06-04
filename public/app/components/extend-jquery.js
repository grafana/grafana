define(['jquery', 'angular', 'lodash'],
function ($, angular, _) {
  'use strict';

  /**
   * jQuery extensions
   */
  var $win = $(window);

  $.fn.place_tt = (function () {
    var defaults = {
      offset: 5,
    };

    return function (x, y, opts) {
      opts = $.extend(true, {}, defaults, opts);

      return this.each(function () {
        var $tooltip = $(this), width, height;

        $tooltip.addClass('grafana-tooltip');

        $("#tooltip").remove();
        $tooltip.appendTo(document.body);

        if (opts.compile) {
          angular.element(document).injector().invoke(function($compile, $rootScope) {
            var tmpScope = $rootScope.$new(true);
            _.extend(tmpScope, opts.scopeData);

            $compile($tooltip)(tmpScope);
            tmpScope.$digest();
            //tmpScope.$destroy();
          });
        }

        width = $tooltip.outerWidth(true);
        height = $tooltip.outerHeight(true);

        $tooltip.css('left', x + opts.offset + width > $win.width() ? x - opts.offset - width : x + opts.offset);
        $tooltip.css('top', y + opts.offset + height > $win.height() ? y - opts.offset - height : y + opts.offset);
      });
    };
  })();

  return $;
});
