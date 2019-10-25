import $ from 'jquery';
import angular from 'angular';
import _ from 'lodash';

const $win = $(window);

$.fn.place_tt = (() => {
  const defaults = {
    offset: 5,
  };

  return function(this: any, x: number, y: number, opts: any) {
    opts = $.extend(true, {}, defaults, opts);

    return this.each(() => {
      const $tooltip = $(this);
      let width, height;

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
            ($compile, $rootScope) => {
              const tmpScope = $rootScope.$new(true);
              _.extend(tmpScope, opts.scopeData);

              $compile($tooltip)(tmpScope);
              tmpScope.$digest();
              tmpScope.$destroy();
            },
          ]);
      }

      width = $tooltip.outerWidth(true);
      height = $tooltip.outerHeight(true);

      $tooltip.css('left', x + opts.offset + width > $win.width() ? x - opts.offset - width : x + opts.offset);
      $tooltip.css('top', y + opts.offset + height > $win.height() ? y - opts.offset - height : y + opts.offset);
    });
  };
})();
