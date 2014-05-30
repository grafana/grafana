define([
  'angular',
  'underscore',
  'jquery'
],
function (angular, _, $) {
  'use strict';

  // This function needs $inject annotations, update below
  // when changing arguments to this function
  function PanelBaseCtrl($scope, $rootScope, $timeout) {

    var menu = [
      {
        text: 'Edit',
        configModal: "app/partials/paneleditor.html",
        condition: !$scope.panelMeta.fullscreenEdit
      },
      {
        text: 'Edit',
        click: "toggleFullscreenEdit()",
        condition: $scope.panelMeta.fullscreenEdit
      },
      {
        text: "Fullscreen",
        click: 'toggleFullscreen()',
        condition: $scope.panelMeta.fullscreenView
      },
      {
        text: 'Duplicate',
        click: 'duplicatePanel(panel)',
        condition: true
      },
      {
        text: 'Span',
        submenu: [
          { text: '1', click: 'updateColumnSpan(1)' },
          { text: '2', click: 'updateColumnSpan(2)' },
          { text: '3', click: 'updateColumnSpan(3)' },
          { text: '4', click: 'updateColumnSpan(4)' },
          { text: '5', click: 'updateColumnSpan(5)' },
          { text: '6', click: 'updateColumnSpan(6)' },
          { text: '7', click: 'updateColumnSpan(7)' },
          { text: '8', click: 'updateColumnSpan(8)' },
          { text: '9', click: 'updateColumnSpan(9)' },
          { text: '10', click: 'updateColumnSpan(10)' },
          { text: '11', click: 'updateColumnSpan(11)' },
          { text: '12', click: 'updateColumnSpan(12)' },
        ],
        condition: true
      },
      {
        text: 'Remove',
        click: 'remove_panel_from_row(row, panel)',
        condition: true
      }
    ];

    $scope.inspector = {};
    $scope.panelMeta.menu = _.where(menu, { condition: true });

    $scope.updateColumnSpan = function(span) {
      $scope.panel.span = span;

      $timeout(function() {
        $scope.$emit('render');
      });
    };

    $scope.enterFullscreenMode = function(options) {
      var docHeight = $(window).height();
      var editHeight = Math.floor(docHeight * 0.3);
      var fullscreenHeight = Math.floor(docHeight * 0.7);
      var oldTimeRange = $scope.range;

      $scope.height = options.edit ? editHeight : fullscreenHeight;
      $scope.editMode = options.edit;

      if (!$scope.fullscreen) {
        var closeEditMode = $rootScope.$on('panel-fullscreen-exit', function() {
          $scope.editMode = false;
          $scope.fullscreen = false;
          delete $scope.height;

          closeEditMode();

          $timeout(function() {
            if (oldTimeRange !== $scope.range) {
              $scope.dashboard.refresh();
            }
            else {
              $scope.$emit('render');
            }
          });
        });
      }

      $(window).scrollTop(0);

      $scope.fullscreen = true;

      $rootScope.$emit('panel-fullscreen-enter');

      $timeout(function() {
        $scope.$emit('render');
      });

    };

    $scope.toggleFullscreenEdit = function() {
      if ($scope.editMode) {
        $rootScope.$emit('panel-fullscreen-exit');
        return;
      }

      $scope.enterFullscreenMode({edit: true});
    };

    $scope.toggleFullscreen = function() {
      if ($scope.fullscreen && !$scope.editMode) {
        $rootScope.$emit('panel-fullscreen-exit');
        return;
      }

      $scope.enterFullscreenMode({ edit: false });
    };

  }

  PanelBaseCtrl['$inject'] = ['$scope', '$rootScope', '$timeout'];

  return PanelBaseCtrl;

});