///<reference path="../../../headers/common.d.ts" />

import $ from 'jquery';
import coreModule from 'app/core/core_module';
import {DashboardModel, CELL_HEIGHT, CELL_VMARGIN} from '../model';

import 'jquery-ui';
import 'gridstack';
import 'gridstack.jquery-ui';

const template = `
<div class="grid-stack">
  <dash-grid-item ng-repeat="panel in ctrl.panels"
                  class="grid-stack-item"
                  grid-ctrl="ctrl"
                  panel="panel">
    <plugin-component type="panel" class="grid-stack-item-content">
    </plugin-component>
  </dash-grid-item>
</div>
`;

export class GridCtrl {
  options: any;
  dashboard: any;
  panels: any;
  gridstack: any;
  gridElem: any;

  /** @ngInject */
  constructor(private $rootScope, private $element, private $timeout) {
    this.panels = this.dashboard.panels;
  }

  init() {
    this.gridElem = this.$element.find('.grid-stack');

    this.gridstack = this.gridElem.gridstack({
      animate: true,
      cellHeight: CELL_HEIGHT,
      verticalMargin: CELL_VMARGIN,
    }).data('gridstack');

    this.gridElem.on('change', (e, items) => {
      this.$timeout(() => this.itemsChanged(items), 50);
    });
  }

  itemsChanged(items) {
    for (let item of items) {
      var panel = this.dashboard.getPanelById(parseInt(item.id));
      panel.x = item.x;
      panel.y = item.y;
      panel.width = item.width;
      panel.height = item.height;
    }
    this.$rootScope.$broadcast('render');
  }

  bindItem(element) {
    this.gridstack.makeWidget(element);
  }
}

/** @ngInject **/
export function dashGrid($timeout) {
  return {
    restrict: 'E',
    template: template,
    controller: GridCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dashboard: "="
    },
    link: function(scope, elem, attrs, ctrl) {
      $timeout(function() {
        ctrl.init();
      });
    }
  };
}

/** @ngInject **/
export function dashGridItem($timeout, $rootScope) {
  return {
    restrict: "E",
    scope: {
      panel: '=',
      gridCtrl: '='
    },
    link: function (scope, element, attrs) {
      let gridCtrl = scope.gridCtrl;
      let panel = scope.panel;

      element.attr({
        'data-gs-id': panel.id,
        'data-gs-x': panel.x,
        'data-gs-y': panel.y,
        'data-gs-width': panel.width,
        'data-gs-height': panel.height,
      });

      $rootScope.onAppEvent('panel-fullscreen-exit', (evt, payload) => {
        if (panel.id !== payload.panelId) {
          return;
        }
        element.removeClass('panel-fullscreen');
      }, scope);

      $rootScope.onAppEvent('panel-fullscreen-enter', (evt, payload) => {
        if (panel.id !== payload.panelId) {
          return;
        }
        element.addClass('panel-fullscreen');
      }, scope);


      //var item = element.data('_gridstack_node');
      //console.log('link item', item);
      //gridCtrl.bindItem(element);

      // element.bind('$destroy', function() {
      //   var item = element.data('_gridstack_node');
      //   scope.onItemRemoved({item: item});
      //   ctrl.removeItem(element);
      // });
    }
  };
}

coreModule.directive('dashGrid', dashGrid);
coreModule.directive('dashGridItem', dashGridItem);
