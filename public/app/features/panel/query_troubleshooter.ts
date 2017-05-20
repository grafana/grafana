///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import appEvents  from 'app/core/app_events';
import {coreModule, JsonExplorer} from 'app/core/core';

const template = `
<collapse-box title="Query Troubleshooter" is-open="ctrl.isOpen" state-changed="ctrl.stateChanged()"
              ng-class="{'collapse-box--error': ctrl.hasError}">
  <collapse-box-actions>
    <a class="pointer" ng-click="ctrl.toggleExpand()" ng-hide="ctrl.allNodesExpanded">
      <i class="fa fa-expand"></i> Expand All
    </a>
    <a class="pointer" ng-click="ctrl.toggleExpand()" ng-show="ctrl.allNodesExpanded">
      <i class="fa fa-expand"></i> Collapse All
    </a>
    <a class="pointer" data-clipboard-text="adasda" clipboard-button><i class="fa fa-clipboard"></i> Copy to Clipboard</a>
  </collapse-box-actions>
  <collapse-box-body>
    <div class="query-troubleshooter-json"></div>
  </collapse-box-body>
</collapse-box>
`;

export class QueryTroubleshooterCtrl {
  isOpen: any;
  showResponse: boolean;
  panelCtrl: any;
  renderJsonExplorer: (data) => void;
  onRequestErrorEventListener: any;
  onRequestResponseEventListener: any;
  hasError: boolean;
  allNodesExpanded: boolean;
  jsonExplorer: JsonExplorer;

  /** @ngInject **/
  constructor($scope, private $timeout) {
    this.onRequestErrorEventListener = this.onRequestError.bind(this);
    this.onRequestResponseEventListener = this.onRequestResponse.bind(this);

    appEvents.on('ds-request-error', this.onRequestErrorEventListener);
    $scope.$on('$destroy',  this.removeEventsListeners.bind(this));
  }

  removeEventsListeners() {
    appEvents.off('ds-request-response', this.onRequestResponseEventListener);
    appEvents.off('ds-request-error', this.onRequestErrorEventListener);
  }

  onRequestError(err) {
    this.isOpen = true;
    this.hasError = true;
    this.onRequestResponse(err);
  }

  stateChanged() {
    if (this.isOpen) {
      appEvents.on('ds-request-response', this.onRequestResponseEventListener);
      this.panelCtrl.refresh();
    } else {
      this.hasError = false;
    }
  }

  onRequestResponse(data) {
    data = _.cloneDeep(data);

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

    this.$timeout(_.partial(this.renderJsonExplorer, data));
  }

  toggleExpand(depth) {
    if (this.jsonExplorer) {
      this.allNodesExpanded = !this.allNodesExpanded;
      this.jsonExplorer.openAtDepth(this.allNodesExpanded ? 20 : 1);
    }
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

        ctrl.jsonExplorer =  new JsonExplorer(data, 3, {
          theme: 'dark',
        });

        const html = ctrl.jsonExplorer.render(true);
        jsonElem.html(html);
      };
    }
  };
}

coreModule.directive('queryTroubleshooter', queryTroubleshooter);
