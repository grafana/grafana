import _ from 'lodash';
import coreModule from '../../core/core_module';
var PlaylistEditCtrl = /** @class */ (function () {
    /** @ngInject */
    function PlaylistEditCtrl($scope, backendSrv, $location, $route, navModelSrv) {
        var _this = this;
        this.$scope = $scope;
        this.backendSrv = backendSrv;
        this.$location = $location;
        this.filteredDashboards = [];
        this.filteredTags = [];
        this.searchQuery = '';
        this.loading = false;
        this.playlist = {
            interval: '5m',
        };
        this.playlistItems = [];
        this.dashboardresult = [];
        this.tagresult = [];
        this.navModel = navModelSrv.getNav('dashboards', 'playlists', 0);
        this.isNew = !$route.current.params.id;
        if ($route.current.params.id) {
            var playlistId = $route.current.params.id;
            backendSrv.get('/api/playlists/' + playlistId).then(function (result) {
                _this.playlist = result;
            });
            backendSrv.get('/api/playlists/' + playlistId + '/items').then(function (result) {
                _this.playlistItems = result;
            });
        }
    }
    PlaylistEditCtrl.prototype.filterFoundPlaylistItems = function () {
        var _this = this;
        this.filteredDashboards = _.reject(this.dashboardresult, function (playlistItem) {
            return _.find(_this.playlistItems, function (listPlaylistItem) {
                return parseInt(listPlaylistItem.value, 10) === playlistItem.id;
            });
        });
        this.filteredTags = _.reject(this.tagresult, function (tag) {
            return _.find(_this.playlistItems, function (listPlaylistItem) {
                return listPlaylistItem.value === tag.term;
            });
        });
    };
    PlaylistEditCtrl.prototype.addPlaylistItem = function (playlistItem) {
        playlistItem.value = playlistItem.id.toString();
        playlistItem.type = 'dashboard_by_id';
        playlistItem.order = this.playlistItems.length + 1;
        this.playlistItems.push(playlistItem);
        this.filterFoundPlaylistItems();
    };
    PlaylistEditCtrl.prototype.addTagPlaylistItem = function (tag) {
        var playlistItem = {
            value: tag.term,
            type: 'dashboard_by_tag',
            order: this.playlistItems.length + 1,
            title: tag.term,
        };
        this.playlistItems.push(playlistItem);
        this.filterFoundPlaylistItems();
    };
    PlaylistEditCtrl.prototype.removePlaylistItem = function (playlistItem) {
        _.remove(this.playlistItems, function (listedPlaylistItem) {
            return playlistItem === listedPlaylistItem;
        });
        this.filterFoundPlaylistItems();
    };
    PlaylistEditCtrl.prototype.savePlaylist = function (playlist, playlistItems) {
        var _this = this;
        var savePromise;
        playlist.items = playlistItems;
        savePromise = playlist.id
            ? this.backendSrv.put('/api/playlists/' + playlist.id, playlist)
            : this.backendSrv.post('/api/playlists', playlist);
        savePromise.then(function () {
            _this.$scope.appEvent('alert-success', ['Playlist saved', '']);
            _this.$location.path('/playlists');
        }, function () {
            _this.$scope.appEvent('alert-error', ['Unable to save playlist', '']);
        });
    };
    PlaylistEditCtrl.prototype.isPlaylistEmpty = function () {
        return !this.playlistItems.length;
    };
    PlaylistEditCtrl.prototype.backToList = function () {
        this.$location.path('/playlists');
    };
    PlaylistEditCtrl.prototype.searchStarted = function (promise) {
        var _this = this;
        promise.then(function (data) {
            _this.dashboardresult = data.dashboardResult;
            _this.tagresult = data.tagResult;
            _this.filterFoundPlaylistItems();
        });
    };
    PlaylistEditCtrl.prototype.movePlaylistItem = function (playlistItem, offset) {
        var currentPosition = this.playlistItems.indexOf(playlistItem);
        var newPosition = currentPosition + offset;
        if (newPosition >= 0 && newPosition < this.playlistItems.length) {
            this.playlistItems.splice(currentPosition, 1);
            this.playlistItems.splice(newPosition, 0, playlistItem);
        }
    };
    PlaylistEditCtrl.prototype.movePlaylistItemUp = function (playlistItem) {
        this.movePlaylistItem(playlistItem, -1);
    };
    PlaylistEditCtrl.prototype.movePlaylistItemDown = function (playlistItem) {
        this.movePlaylistItem(playlistItem, 1);
    };
    return PlaylistEditCtrl;
}());
export { PlaylistEditCtrl };
coreModule.controller('PlaylistEditCtrl', PlaylistEditCtrl);
//# sourceMappingURL=playlist_edit_ctrl.js.map