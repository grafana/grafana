///<reference path="../../../headers/common.d.ts" />

import $ from 'jquery';
import _ from 'lodash';
import coreModule from 'app/core/core_module';
import {DashboardModel, CELL_HEIGHT, CELL_VMARGIN} from '../model';

import 'jquery-ui';
import 'gridstack';
import 'gridstack.jquery-ui';

const template = `
<div class="grid-stack">
  <dash-grid-item ng-repeat="panel in ctrl.dashboard.panels track by panel.id"
                  class="grid-stack-item"
                  grid-ctrl="ctrl"
                  panel="panel">
    <plugin-component type="panel" class="grid-stack-item-content">
    </plugin-component>
  </dash-grid-item>
</div>
`;

var rowIndex = 0;

export class GridCtrl {
  options: any;
  dashboard: any;
  panels: any;
  gridstack: any;
  gridElem: any;
  isInitialized: boolean;
  isDestroyed: boolean;
  index: number;
  changeRenderPromise: any;

  /** @ngInject */
  constructor(private $scope, private $element, private $timeout) {
    console.log(this.dashboard);
    this.index = rowIndex;
    rowIndex += 1;
  }

  init() {
    this.gridElem = this.$element.find('.grid-stack');

    this.gridstack = this.gridElem.gridstack({
      animate: true,
      cellHeight: CELL_HEIGHT,
      verticalMargin: CELL_VMARGIN,
      acceptWidgets: '.grid-stack-item',
      handle: '.grid-drag-handle'
    }).data('gridstack');

    this.isInitialized = true;

    this.gridElem.on('added', (e, items) => {
      for (let item of items) {
        this.onGridStackItemAdded(item);
      }
    });

    this.gridElem.on('removed', (e, items) => {
      for (let item of items) {
        this.onGridStackItemRemoved(item);
      }
    });

    this.gridElem.on('change', (e, items) => {
      this.$timeout(() => this.onGridStackItemsChanged(items), 50);
    });
  }

  onGridStackItemAdded(item) {
    console.log('row: ' + this.index + ' item added', item);
  }

  onGridStackItemRemoved(item) {
    console.log('row: ' + this.index + ' item removed', item.id, item);
  }

  onGridStackItemsChanged(items) {
    console.log('onGridStackItemsChanged');

    for (let item of items) {
      // find panel
      var panel = this.dashboard.getPanelById(parseInt(item.id));

      if (!panel) {
        console.log('item change but no panel found for item', item);
        continue;
      }

      // update panel model position
      panel.x = item.x;
      panel.y = item.y;
      panel.width = item.width;
      panel.height = item.height;

      console.log('updating panel: ' + panel.id + ' x: ' + panel.x + ' y: ' + panel.y);
    }

    this.dashboard.panels.sort(function (a, b) {
      let aScore = a.x + (a.y * 12);
      let bScore = b.x + (b.y * 12);
      if (aScore < bScore) { return -1; }
      if (aScore > bScore) { return 1; }
      return 0;
    });

    if (this.changeRenderPromise) {
      this.$timeout.cancel(this.changeRenderPromise);
    }

    this.changeRenderPromise = this.$timeout(() => {
      console.log('broadcasting render');
      this.$scope.$broadcast('render');
    });
  }

  destroy() {
    this.gridstack.destroy();
    this.gridstack = null;
    this.isDestroyed = true;
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
      dashboard: "=",
    },
    link: function(scope, elem, attrs, ctrl) {
      $timeout(function() {
        ctrl.init();
      });

      scope.$on('$destroy', () => {
        ctrl.destroy();
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
      let gridStackNode = null;

      element.attr({
        'data-gs-id': panel.id,
        'data-gs-x': panel.x,
        'data-gs-y': panel.y,
        'data-gs-width': panel.width,
        'data-gs-height': panel.height,
        'data-gs-no-resize': panel.type === 'row',
      });

      // listen for row moments
      scope.$watch("panel.y", function(newModelY) {
        let elementY = parseInt(element.attr('data-gs-y'));
        console.log('new panel y', newModelY, elementY);
        if (_.isNumber(newModelY) && elementY !== newModelY) {
          gridCtrl.gridstack.move(element, panel.x, panel.y);
        }
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

      scope.$on('$destroy', () => {
        console.log('grid-item scope $destroy');
        if (gridCtrl.isDestroyed) {
          return;
        }

        if (gridStackNode) {
          console.log('grid-item scope $destroy removeWidget');
          gridStackNode._grid.removeWidget(element);
        }
      });

      if (gridCtrl.isInitialized) {
        gridCtrl.gridstack.makeWidget(element);
        gridStackNode = element.data('_gridstack_node');
      } else {
        setTimeout(function() {
          gridStackNode = element.data('_gridstack_node');
        }, 500);
      }
    }
  };
}

coreModule.directive('dashGrid', dashGrid);
coreModule.directive('dashGridItem', dashGridItem);
