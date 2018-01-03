import _ from 'lodash';
import coreModule from '../core_module';

coreModule.directive('dashClass', function($timeout) {
  return {
    link: function($scope, elem) {
      $scope.ctrl.dashboard.events.on('view-mode-changed', function(panel) {
        $timeout(() => {
          elem.toggleClass('panel-in-fullscreen', panel.fullscreen === true);
        });
      });

      $scope.onAppEvent('panel-fullscreen-exit', function() {
        elem.toggleClass('panel-in-fullscreen', false);
      });

      $scope.$watch('ctrl.playlistSrv.isPlaying', function(newValue) {
        elem.toggleClass('playlist-active', newValue === true);
      });

      $scope.$watch('ctrl.dashboardViewState.state.editview', function(newValue) {
        if (newValue) {
          elem.toggleClass('dashboard-page--settings-opening', _.isString(newValue));
          setTimeout(function() {
            elem.toggleClass('dashboard-page--settings-open', _.isString(newValue));
          }, 10);
        } else {
          elem.removeClass('dashboard-page--settings-opening');
          elem.removeClass('dashboard-page--settings-open');
        }
      });
    },
  };
});
