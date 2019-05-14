import _ from 'lodash';
import coreModule from '../../core/core_module';
var PlaylistsCtrl = /** @class */ (function () {
    /** @ngInject */
    function PlaylistsCtrl($scope, backendSrv, navModelSrv) {
        var _this = this;
        this.$scope = $scope;
        this.backendSrv = backendSrv;
        this.navModel = navModelSrv.getNav('dashboards', 'playlists', 0);
        backendSrv.get('/api/playlists').then(function (result) {
            _this.playlists = result.map(function (item) {
                item.startUrl = "playlists/play/" + item.id;
                return item;
            });
        });
    }
    PlaylistsCtrl.prototype.removePlaylistConfirmed = function (playlist) {
        var _this = this;
        _.remove(this.playlists, { id: playlist.id });
        this.backendSrv.delete('/api/playlists/' + playlist.id).then(function () {
            _this.$scope.appEvent('alert-success', ['Playlist deleted', '']);
        }, function () {
            _this.$scope.appEvent('alert-error', ['Unable to delete playlist', '']);
            _this.playlists.push(playlist);
        });
    };
    PlaylistsCtrl.prototype.removePlaylist = function (playlist) {
        var _this = this;
        this.$scope.appEvent('confirm-modal', {
            title: 'Delete',
            text: 'Are you sure you want to delete playlist ' + playlist.name + '?',
            yesText: 'Delete',
            icon: 'fa-trash',
            onConfirm: function () {
                _this.removePlaylistConfirmed(playlist);
            },
        });
    };
    return PlaylistsCtrl;
}());
export { PlaylistsCtrl };
coreModule.controller('PlaylistsCtrl', PlaylistsCtrl);
//# sourceMappingURL=playlists_ctrl.js.map