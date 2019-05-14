import angular from 'angular';
import _ from 'lodash';
var ShareSnapshotCtrl = /** @class */ (function () {
    /** @ngInject */
    function ShareSnapshotCtrl($scope, $rootScope, $location, backendSrv, $timeout, timeSrv) {
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
        $scope.init = function () {
            backendSrv.get('/api/snapshot/shared-options').then(function (options) {
                $scope.sharingButtonText = options['externalSnapshotName'];
                $scope.externalEnabled = options['externalEnabled'];
            });
        };
        $scope.apiUrl = '/api/snapshots';
        $scope.createSnapshot = function (external) {
            $scope.dashboard.snapshot = {
                timestamp: new Date(),
            };
            if (!external) {
                $scope.dashboard.snapshot.originalUrl = $location.absUrl();
            }
            $scope.loading = true;
            $scope.snapshot.external = external;
            $scope.dashboard.startRefresh();
            $timeout(function () {
                $scope.saveSnapshot(external);
            }, $scope.snapshot.timeoutSeconds * 1000);
        };
        $scope.saveSnapshot = function (external) {
            var dash = $scope.dashboard.getSaveModelClone();
            $scope.scrubDashboard(dash);
            var cmdData = {
                dashboard: dash,
                name: dash.title,
                expires: $scope.snapshot.expires,
                external: external,
            };
            backendSrv.post($scope.apiUrl, cmdData).then(function (results) {
                $scope.loading = false;
                $scope.deleteUrl = results.deleteUrl;
                $scope.snapshotUrl = results.url;
                $scope.step = 2;
            }, function () {
                $scope.loading = false;
            });
        };
        $scope.getSnapshotUrl = function () {
            return $scope.snapshotUrl;
        };
        $scope.scrubDashboard = function (dash) {
            // change title
            dash.title = $scope.snapshot.name;
            // make relative times absolute
            dash.time = timeSrv.timeRange();
            // remove panel queries & links
            _.each(dash.panels, function (panel) {
                panel.targets = [];
                panel.links = [];
                panel.datasource = null;
            });
            // remove annotation queries
            dash.annotations.list = _.chain(dash.annotations.list)
                .filter(function (annotation) {
                return annotation.enable;
            })
                .map(function (annotation) {
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
            _.each(dash.templating.list, function (variable) {
                variable.query = '';
                variable.options = variable.current;
                variable.refresh = false;
            });
            // snapshot single panel
            if ($scope.modeSharePanel) {
                var singlePanel = $scope.panel.getSaveModel();
                singlePanel.gridPos.w = 24;
                singlePanel.gridPos.x = 0;
                singlePanel.gridPos.y = 0;
                singlePanel.gridPos.h = 20;
                dash.panels = [singlePanel];
            }
            // cleanup snapshotData
            delete $scope.dashboard.snapshot;
            $scope.dashboard.forEachPanel(function (panel) {
                delete panel.snapshotData;
            });
            _.each($scope.dashboard.annotations.list, function (annotation) {
                delete annotation.snapshotData;
            });
        };
        $scope.deleteSnapshot = function () {
            backendSrv.get($scope.deleteUrl).then(function () {
                $scope.step = 3;
            });
        };
    }
    return ShareSnapshotCtrl;
}());
export { ShareSnapshotCtrl };
angular.module('grafana.controllers').controller('ShareSnapshotCtrl', ShareSnapshotCtrl);
//# sourceMappingURL=ShareSnapshotCtrl.js.map