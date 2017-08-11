///<reference path="../../../headers/common.d.ts" />

import $ from 'jquery';
import coreModule from 'app/core/core_module';
import {DashboardModel, CELL_HEIGHT, CELL_VMARGIN} from '../model';

import 'jquery-ui';
import 'gridstack';
import 'gridstack.jquery-ui';

const template = `
<div class="grid-stack">
  <dash-grid-item ng-repeat="panel in ctrl.row.panels track by panel.id"
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
  row: any;
  dashboard: any;
  panels: any;
  gridstack: any;
  gridElem: any;
  isInitialized: boolean;
  isDestroyed: boolean;
  index: number;

  /** @ngInject */
  constructor(private $scope, private $element, private $timeout) {
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
      handle: '.panel-header'
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
    // if item has id dont need to do anything
    if (item.id) {
      return;
    }

    // if this comes from another row we need to remove it
    this.$timeout(() => this.gridstack.removeWidget(item.el, true));
  }

  onGridStackItemRemoved(item) {
    console.log('row: ' + this.index + ' item removed', item.id, item);
    // ignore items that have no panel id
    // if (!item.id) {
    //   return;
    // }
    //
    // let panel = this.dashboard.getPanelById(parseInt(item.id));
    //
    // if (panel) {
    //   panelChangingRow = panel
    //   this.row.removePanel(panel, false);
    // }
  }

  onGridStackItemsChanged(items) {
    console.log('row: ' +this.index + ' changes', items);

    for (let item of items) {
      let isFromOtherRow = false;

      if (!item.id) {
        item.id  = parseInt(item.el.attr('data-gs-id'));
        isFromOtherRow = true;
      }

      // find panel
      var panelInfo = this.dashboard.getPanelInfoById(parseInt(item.id));

      if (!panelInfo) {
        console.log('row: ' + this.index + ' item change but no panel found for item', item);
        continue;
      }

      // update panel model position
      let panel = panelInfo.panel;
      panel.x = item.x;
      panel.y = item.y;
      panel.width = item.width;
      panel.height = item.height;

      // wait a bit before adding
      if (isFromOtherRow) {
        let movePanelFn = (panel, row) => {
          return this.$timeout(() => {
            console.log('moving panel movel to another row', panel);
            // remove from source row
            row.removePanel(panel, false);
            // add this this row
            this.row.panels.push(panel);
          });
        };
        movePanelFn(panelInfo.panel, panelInfo.row);
      }
    }

    this.$scope.$broadcast('render');
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
      row: "=",
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

      scope.$on('$destroy', () => {
        console.log('grid-item scope $destroy');
        if (gridCtrl.isDestroyed) {
          return;
        }

        let node = element.data('_gridstack_node');
        if (node) {
          console.log('grid-item scope $destroy removeWidget');
          node._grid.removeWidget(element);
        }
      });

      if (gridCtrl.isInitialized) {
        gridCtrl.gridstack.makeWidget(element);
      }

      //   scope.onItemRemoved({item: item});
      //   ctrl.removeItem(element);


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
