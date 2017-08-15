///<reference path="../../../headers/common.d.ts" />

import GeminiScrollbar from 'gemini-scrollbar';
import coreModule from 'app/core/core_module';
import _ from 'lodash';

export function geminiScrollbar() {
  return {
    restrict: 'A',
    link: function(scope, elem, attrs) {
      var myScrollbar = new GeminiScrollbar({
        autoshow: false,
        element: elem[0]
      }).create();
    }
  };
}

coreModule.directive('geminiScrollbar', geminiScrollbar);
