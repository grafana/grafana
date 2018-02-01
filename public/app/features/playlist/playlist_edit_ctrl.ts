import _ from 'lodash';
import coreModule from '../../core/core_module';

export class PlaylistEditCtrl {
  filteredDashboards: any = [];
  filteredTags: any = [];
  searchQuery = '';
  loading = false;
  playlist: any = {
    interval: '5m',
  };

  playlistItems: any = [];
  dashboardresult: any = [];
  tagresult: any = [];
  navModel: any;
  isNew: boolean;

  /** @ngInject */
  constructor(private $scope, private backendSrv, private $location, $route, navModelSrv) {
    this.navModel = navModelSrv.getNav('dashboards', 'playlists', 0);
    this.isNew = $route.current.params.id;

    if ($route.current.params.id) {
      var playlistId = $route.current.params.id;

      backendSrv.get('/api/playlists/' + playlistId).then(result => {
        this.playlist = result;
        this.navModel.node = {
          text: result.name,
          icon: this.navModel.node.icon,
        };
        this.navModel.breadcrumbs.push(this.navModel.node);
      });

      backendSrv.get('/api/playlists/' + playlistId + '/items').then(result => {
        this.playlistItems = result;
      });
    } else {
      this.navModel.node = {
        text: 'New playlist',
        icon: this.navModel.node.icon,
      };
      this.navModel.breadcrumbs.push(this.navModel.node);
    }
  }

  filterFoundPlaylistItems() {
    this.filteredDashboards = _.reject(this.dashboardresult, playlistItem => {
      return _.find(this.playlistItems, listPlaylistItem => {
        return parseInt(listPlaylistItem.value) === playlistItem.id;
      });
    });

    this.filteredTags = _.reject(this.tagresult, tag => {
      return _.find(this.playlistItems, listPlaylistItem => {
        return listPlaylistItem.value === tag.term;
      });
    });
  }

  addPlaylistItem(playlistItem) {
    playlistItem.value = playlistItem.id.toString();
    playlistItem.type = 'dashboard_by_id';
    playlistItem.order = this.playlistItems.length + 1;

    this.playlistItems.push(playlistItem);
    this.filterFoundPlaylistItems();
  }

  addTagPlaylistItem(tag) {
    var playlistItem: any = {
      value: tag.term,
      type: 'dashboard_by_tag',
      order: this.playlistItems.length + 1,
      title: tag.term,
    };

    this.playlistItems.push(playlistItem);
    this.filterFoundPlaylistItems();
  }

  removePlaylistItem(playlistItem) {
    _.remove(this.playlistItems, listedPlaylistItem => {
      return playlistItem === listedPlaylistItem;
    });
    this.filterFoundPlaylistItems();
  }

  savePlaylist(playlist, playlistItems) {
    var savePromise;

    playlist.items = playlistItems;

    savePromise = playlist.id
      ? this.backendSrv.put('/api/playlists/' + playlist.id, playlist)
      : this.backendSrv.post('/api/playlists', playlist);

    savePromise.then(
      () => {
        this.$scope.appEvent('alert-success', ['Playlist saved', '']);
        this.$location.path('/playlists');
      },
      () => {
        this.$scope.appEvent('alert-error', ['Unable to save playlist', '']);
      }
    );
  }

  isPlaylistEmpty() {
    return !this.playlistItems.length;
  }

  backToList() {
    this.$location.path('/playlists');
  }

  searchStarted(promise) {
    promise.then(data => {
      this.dashboardresult = data.dashboardResult;
      this.tagresult = data.tagResult;
      this.filterFoundPlaylistItems();
    });
  }

  movePlaylistItem(playlistItem, offset) {
    var currentPosition = this.playlistItems.indexOf(playlistItem);
    var newPosition = currentPosition + offset;

    if (newPosition >= 0 && newPosition < this.playlistItems.length) {
      this.playlistItems.splice(currentPosition, 1);
      this.playlistItems.splice(newPosition, 0, playlistItem);
    }
  }

  movePlaylistItemUp(playlistItem) {
    this.movePlaylistItem(playlistItem, -1);
  }

  movePlaylistItemDown(playlistItem) {
    this.movePlaylistItem(playlistItem, 1);
  }
}

coreModule.controller('PlaylistEditCtrl', PlaylistEditCtrl);
