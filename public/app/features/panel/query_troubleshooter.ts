///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import appEvents  from 'app/core/app_events';
import {coreModule, JsonExplorer} from 'app/core/core';

const template = `
<collapse-box title="Query Troubleshooter" is-open="ctrl.showResponse" on-open="ctrl.onOpen()">
  <collapse-box-actions>
    <a class="pointer"><i class="fa fa-clipboard"></i> Copy to clipboard</a>
  </collapse-box-actions>
  <collapse-box-body>
    <div class="query-troubleshooter-json"></div>
  </collapse-box-body>
</collapse-box>
`;

export class QueryTroubleshooterCtrl {
  responseData: any;
  showResponse: boolean;
  panelCtrl: any;
  renderJsonExplorer: (data) => void;

  /** @ngInject **/
  constructor($scope, private $timeout) {
    appEvents.on('ds-request-response', this.onRequestResponse.bind(this), $scope);
    appEvents.on('ds-request-error', this.onRequestError.bind(this), $scope);
  }

  onRequestResponse(data) {
    this.responseData = data;
  }

  toggleShowResponse() {
    this.showResponse = !this.showResponse;
  }

  onRequestError(err) {
    this.responseData = err;
    this.responseData.isError = true;
    this.showResponse = true;
  }

  onOpen() {
    if (!this.responseData) {
      console.log('no data');
      return;
    }

    var data = this.responseData;
    if (data.headers) {
      delete data.headers;
    }

    if (data.config) {
      data.request = data.config;
      delete data.config;
      delete data.request.transformRequest;
      delete data.request.transformResponse;
      delete data.request.paramSerializer;
      delete data.request.jsonpCallbackParam;
      delete data.request.headers;
      delete data.request.requestId;
      delete data.request.inspect;
      delete data.request.retry;
      delete data.request.timeout;
    }

    if (data.data) {
      data.response = data.data;

      delete data.data;
      delete data.status;
      delete data.statusText;
      delete data.$$config;
    }

    this.$timeout(_.partial(this.renderJsonExplorer, data), 10);
  }
}

export function queryTroubleshooter() {
  return {
    restrict: 'E',
    template: template,
    controller: QueryTroubleshooterCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      panelCtrl: "="
    },
    link: function(scope, elem, attrs, ctrl) {

      ctrl.renderJsonExplorer = function(data) {
        var jsonElem = elem.find('.query-troubleshooter-json');

        const formatter =  new JsonExplorer(data, 2, {
          theme: 'dark',
        });

        const html = formatter.render(true);
        jsonElem.html(html);
      };
    }
  };
}

coreModule.directive('queryTroubleshooter', queryTroubleshooter);
