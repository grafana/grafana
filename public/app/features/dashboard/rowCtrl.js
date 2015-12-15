define([
  'angular',
  'lodash',
  'app/core/config'
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('RowCtrl', function($scope, $rootScope, $timeout) {
    var _d = {
      title: "Row",
      height: "150px",
      collapse: false,
      editable: true,
      panels: [],
    };

    _.defaults($scope.row,_d);

    $scope.init = function() {
      $scope.editor = {index: 0};
    };

    $scope.togglePanelMenu = function(posX) {
      $scope.showPanelMenu = !$scope.showPanelMenu;
      $scope.panelMenuPos = posX;
    };

    $scope.toggleRow = function(row) {
      row.collapse = row.collapse ? false : true;
      if (!row.collapse) {
        $timeout(function() {
          $scope.$broadcast('render');
        });
      }
    };

    $scope.addPanel = function(panel) {
      $scope.dashboard.addPanel(panel, $scope.row);
    };


    $scope.deleteRow = function() {
      function delete_row() {
        $scope.dashboard.rows = _.without($scope.dashboard.rows, $scope.row);
      }

      if (!$scope.row.panels.length) {
        delete_row();
        return;
      }

      $scope.appEvent('confirm-modal', {
        title: 'Are you sure you want to delete this row?',
        icon: 'fa-trash',
        yesText: 'Delete',
        onConfirm: function() {
          delete_row();
        }
      });
    };

    $scope.moveRow = function(direction) {
      var rowsList = $scope.dashboard.rows;
      var rowIndex = _.indexOf(rowsList, $scope.row);
      var newIndex = rowIndex;
      switch(direction) {
        case 'up': {
          newIndex = rowIndex - 1;
          break;
        }
        case 'down': {
          newIndex = rowIndex + 1;
          break;
        }
        case 'top': {
          newIndex = 0;
          break;
        }
        case 'bottom': {
          newIndex = rowsList.length - 1;
          break;
        }
        default: {
          newIndex = rowIndex;
        }
      }
      if (newIndex >= 0 && newIndex <= (rowsList.length - 1)) {
        _.move(rowsList, rowIndex, newIndex);
      }
    };

    $scope.addPanelDefault = function(type) {
      var defaultSpan = 12;
      var _as = 12 - $scope.dashboard.rowSpan($scope.row);

      var panel = {
        title: config.new_panel_title,
        error: false,
        span: _as < defaultSpan && _as > 0 ? _as : defaultSpan,
        editable: true,
        type: type,
        isNew: true,
      };

      $scope.addPanel(panel);

      $timeout(function() {
        $scope.dashboardViewState.update({fullscreen: true, edit: true, panelId: panel.id });
      });
    };

    $scope.setHeight = function(height) {
      $scope.row.height = height;
      $scope.$broadcast('render');
    };

    $scope.removePanel = function(panel) {
      $scope.appEvent('confirm-modal', {
        title: 'Are you sure you want to remove this panel?',
        icon: 'fa-trash',
        yesText: 'Delete',
        onConfirm: function() {
          $scope.row.panels = _.without($scope.row.panels, panel);
        }
      });
    };

    $scope.updatePanelSpan = function(panel, span) {
      panel.span = Math.min(Math.max(Math.floor(panel.span + span), 1), 12);
    };

    $scope.replacePanel = function(newPanel, oldPanel) {
      var row = $scope.row;
      var index = _.indexOf(row.panels, oldPanel);
      row.panels.splice(index, 1);

      // adding it back needs to be done in next digest
      $timeout(function() {
        newPanel.id = oldPanel.id;
        newPanel.span = oldPanel.span;
        row.panels.splice(index, 0, newPanel);
      });
    };

    $scope.init();

  });

  module.directive('rowHeight', function() {
    return function(scope, element) {
      scope.$watchGroup(['row.collapse', 'row.height'], function() {
        element.css({ minHeight: scope.row.collapse ? '5px' : scope.row.height });
      });

      scope.onAppEvent('panel-fullscreen-enter', function(evt, info) {
        var hasPanel = _.findWhere(scope.row.panels, {id: info.panelId});
        if (!hasPanel) {
          element.hide();
        }
      });

      scope.onAppEvent('panel-fullscreen-exit', function() {
        element.show();
      });
    };
  });

  module.directive('panelWidth', function() {
    return function(scope, element) {
      function updateWidth() {
        element[0].style.width = ((scope.panel.span / 1.2) * 10) + '%';
      }

      scope.onAppEvent('panel-fullscreen-enter', function(evt, info) {
        if (scope.panel.id !== info.panelId) {
          element.hide();
        } else {
          element[0].style.width = '100%';
        }
      });

      scope.onAppEvent('panel-fullscreen-exit', function(evt, info) {
        if (scope.panel.id !== info.panelId) {
          element.show();
        } else {
          updateWidth();
        }
      });

      scope.$watch('panel.span', updateWidth);
    };
  });

  module.directive('panelDropZone', function() {
    return function(scope, element) {
      scope.$on("ANGULAR_DRAG_START", function() {
        var dropZoneSpan = 12 - scope.dashboard.rowSpan(scope.row);

        if (dropZoneSpan > 0) {
          element.find('.panel-container').css('height', scope.row.height);
          element[0].style.width = ((dropZoneSpan / 1.2) * 10) + '%';
          element.show();
        }
      });

      scope.$on("ANGULAR_DRAG_END", function() {
        element.hide();
      });
    };
  });

});
