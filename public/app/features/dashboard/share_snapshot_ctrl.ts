import angular from 'angular';
import _ from 'lodash';

export class ShareSnapshotCtrl {
  /** @ngInject */
  constructor($scope, $rootScope, $location, backendSrv, $timeout, timeSrv) {
    $scope.snapshot = {
      name: $scope.dashboard.title,
      expires: 0,
      timeoutSeconds: 4,
    };

    $scope.step = 1;

    $scope.expireOptions = [
      { text: '1 Hour', value: 60 * 60 },
      { text: '1 Day', value: 60 * 60 * 24 },
      { text: '7 Days', value: 60 * 60 * 24 * 7 },
      { text: 'Never', value: 0 },
    ];

    $scope.accessOptions = [
      { text: 'Anyone with the link', value: 1 },
      { text: 'Organization users', value: 2 },
      { text: 'Public on the web', value: 3 },
    ];

    $scope.init = () => {
      backendSrv.get('/api/snapshot/shared-options').then(options => {
        $scope.externalUrl = options['externalSnapshotURL'];
        $scope.sharingButtonText = options['externalSnapshotName'];
        $scope.externalEnabled = options['externalEnabled'];
      });
    };

    $scope.apiUrl = '/api/snapshots';

    $scope.createSnapshot = external => {
      $scope.dashboard.snapshot = {
        timestamp: new Date(),
      };

      if (!external) {
        $scope.dashboard.snapshot.originalUrl = $location.absUrl();
      }

      $scope.loading = true;
      $scope.snapshot.external = external;
      $scope.dashboard.startRefresh();

      $timeout(() => {
        $scope.saveSnapshot(external);
      }, $scope.snapshot.timeoutSeconds * 1000);
    };

    $scope.saveSnapshot = external => {
      const dash = $scope.dashboard.getSaveModelClone();
      $scope.scrubDashboard(dash);

      const cmdData = {
        dashboard: dash,
        name: dash.title,
        expires: $scope.snapshot.expires,
      };

      const postUrl = external ? $scope.externalUrl + $scope.apiUrl : $scope.apiUrl;

      backendSrv.post(postUrl, cmdData).then(
        results => {
          $scope.loading = false;

          if (external) {
            $scope.deleteUrl = results.deleteUrl;
            $scope.snapshotUrl = results.url;
            $scope.saveExternalSnapshotRef(cmdData, results);
          } else {
            const url = $location.url();
            let baseUrl = $location.absUrl();

            if (url !== '/') {
              baseUrl = baseUrl.replace(url, '') + '/';
            }

            $scope.snapshotUrl = baseUrl + 'dashboard/snapshot/' + results.key;
            $scope.deleteUrl = baseUrl + 'api/snapshots-delete/' + results.deleteKey;
          }

          $scope.step = 2;
        },
        () => {
          $scope.loading = false;
        }
      );
    };

    $scope.getSnapshotUrl = () => {
      return $scope.snapshotUrl;
    };

    $scope.scrubDashboard = dash => {
      // change title
      dash.title = $scope.snapshot.name;

      // make relative times absolute
      dash.time = timeSrv.timeRange();

      // remove panel queries & links
      _.each(dash.panels, panel => {
        panel.targets = [];
        panel.links = [];
        panel.datasource = null;
      });

      // remove annotation queries
      dash.annotations.list = _.chain(dash.annotations.list)
        .filter(annotation => {
          return annotation.enable;
        })
        .map(annotation => {
          return {
            name: annotation.name,
            enable: annotation.enable,
            iconColor: annotation.iconColor,
            snapshotData: annotation.snapshotData,
            type: annotation.type,
            builtIn: annotation.builtIn,
            hide: annotation.hide,
          };
        })
        .value();

      // remove template queries
      _.each(dash.templating.list, variable => {
        variable.query = '';
        variable.options = variable.current;
        variable.refresh = false;
      });

      // snapshot single panel
      if ($scope.modeSharePanel) {
        const singlePanel = $scope.panel.getSaveModel();
        singlePanel.gridPos.w = 24;
        singlePanel.gridPos.x = 0;
        singlePanel.gridPos.y = 0;
        singlePanel.gridPos.h = 20;
        dash.panels = [singlePanel];
      }

      // cleanup snapshotData
      delete $scope.dashboard.snapshot;
      $scope.dashboard.forEachPanel(panel => {
        delete panel.snapshotData;
      });
      _.each($scope.dashboard.annotations.list, annotation => {
        delete annotation.snapshotData;
      });
    };

    $scope.deleteSnapshot = () => {
      backendSrv.get($scope.deleteUrl).then(() => {
        $scope.step = 3;
      });
    };

    $scope.saveExternalSnapshotRef = (cmdData, results) => {
      // save external in local instance as well
      cmdData.external = true;
      cmdData.key = results.key;
      cmdData.deleteKey = results.deleteKey;
      backendSrv.post('/api/snapshots/', cmdData);
    };
  }
}

angular.module('grafana.controllers').controller('ShareSnapshotCtrl', ShareSnapshotCtrl);
