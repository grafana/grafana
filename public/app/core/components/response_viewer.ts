///<reference path="../../headers/common.d.ts" />

import coreModule from 'app/core/core_module';
import JsonFormatter from 'json-formatter-js';


const template = `
<div class="response-viewer">
  <div class="response-viewer-json"></div>
</div>
`;

export function responseViewer() {
  return {
    restrict: 'E',
    template: template,
    scope: {response: "="},
    link: function(scope, elem) {
      var jsonElem = elem.find('.response-viewer-json');

      scope.$watch("response", newVal => {
        if (!newVal) {
          elem.empty();
          return;
        }

        if (scope.response.headers) {
          delete scope.response.headers;
        }

        if (scope.response.data) {
          scope.response.response = scope.response.data;
          delete scope.response.data;
        }

        if (scope.response.config) {
          scope.response.request = scope.response.config;
          delete scope.response.config;
          delete scope.response.request.transformRequest;
          delete scope.response.request.transformResponse;
          delete scope.response.request.paramSerializer;
          delete scope.response.request.jsonpCallbackParam;
          delete scope.response.request.headers;
          delete scope.response.request.requestId;
          delete scope.response.request.inspect;
          delete scope.response.request.retry;
          delete scope.response.request.timeout;
        }


        const formatter =  new JsonFormatter(scope.response, 2, {
          theme: 'dark',
        });

        const html = formatter.render();
        jsonElem.html(html);
      });

    }
  };
}

coreModule.directive('responseViewer', responseViewer);
