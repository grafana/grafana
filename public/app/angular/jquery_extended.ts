import angular from 'angular';
import $ from 'jquery';
import { extend } from 'lodash';

const $win = $(window);

$.fn.place_tt = (() => {
  const defaults = {
    offset: 5,
  };

  return function (this: any, x: number, y: number, opts: any) {
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
              extend(tmpScope, opts.scopeData);

              $compile($tooltip)(tmpScope);
              tmpScope.$digest();
              tmpScope.$destroy();
            },
          ]);
      }

      width = $tooltip.outerWidth(true)!;
      height = $tooltip.outerHeight(true)!;

      const left = x + opts.offset + width > $win.width()! ? x - opts.offset - width : x + opts.offset;
      const top = y + opts.offset + height > $win.height()! ? y - opts.offset - height : y + opts.offset;

      $tooltip.css('left', left > 0 ? left : 0);
      $tooltip.css('top', top > 0 ? top : 0);
    });
  };
})();
