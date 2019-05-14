import * as tslib_1 from "tslib";
import _ from 'lodash';
var SnapshotListCtrl = /** @class */ (function () {
    /** @ngInject */
    function SnapshotListCtrl($rootScope, backendSrv, navModelSrv, $location) {
        var _this = this;
        this.$rootScope = $rootScope;
        this.backendSrv = backendSrv;
        this.$location = $location;
        this.navModel = navModelSrv.getNav('dashboards', 'snapshots', 0);
        this.backendSrv.get('/api/dashboard/snapshots').then(function (result) {
            var baseUrl = _this.$location.absUrl().replace($location.url(), '');
            _this.snapshots = result.map(function (snapshot) { return (tslib_1.__assign({}, snapshot, { url: snapshot.externalUrl || baseUrl + "/dashboard/snapshot/" + snapshot.key })); });
        });
    }
    SnapshotListCtrl.prototype.removeSnapshotConfirmed = function (snapshot) {
        var _this = this;
        _.remove(this.snapshots, { key: snapshot.key });
        this.backendSrv.delete('/api/snapshots/' + snapshot.key).then(function () { }, function () {
            _this.snapshots.push(snapshot);
        });
    };
    SnapshotListCtrl.prototype.removeSnapshot = function (snapshot) {
        var _this = this;
        this.$rootScope.appEvent('confirm-modal', {
            title: 'Delete',
            text: 'Are you sure you want to delete snapshot ' + snapshot.name + '?',
            yesText: 'Delete',
            icon: 'fa-trash',
            onConfirm: function () {
                _this.removeSnapshotConfirmed(snapshot);
            },
        });
    };
    return SnapshotListCtrl;
}());
export { SnapshotListCtrl };
//# sourceMappingURL=SnapshotListCtrl.js.map