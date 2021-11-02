import { __awaiter, __generator, __read } from "tslib";
import React, { useState } from 'react';
import { connect } from 'react-redux';
import Page from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { useDebounce } from 'react-use';
import { ConfirmModal } from '@grafana/ui';
import PageActionBar from 'app/core/components/PageActionBar/PageActionBar';
import EmptyListCTA from '../../core/components/EmptyListCTA/EmptyListCTA';
import { deletePlaylist, getAllPlaylist } from './api';
import { StartModal } from './StartModal';
import { PlaylistPageList } from './PlaylistPageList';
import { EmptyQueryListBanner } from './EmptyQueryListBanner';
export var PlaylistPage = function (_a) {
    var navModel = _a.navModel;
    var _b = __read(useState(''), 2), searchQuery = _b[0], setSearchQuery = _b[1];
    var _c = __read(useState(searchQuery), 2), debouncedSearchQuery = _c[0], setDebouncedSearchQuery = _c[1];
    var _d = __read(useState(false), 2), hasFetched = _d[0], setHasFetched = _d[1];
    var _e = __read(useState(), 2), startPlaylist = _e[0], setStartPlaylist = _e[1];
    var _f = __read(useState(), 2), playlistToDelete = _f[0], setPlaylistToDelete = _f[1];
    var _g = __read(useState(0), 2), forcePlaylistsFetch = _g[0], setForcePlaylistsFetch = _g[1];
    var _h = __read(useState([]), 2), playlists = _h[0], setPlaylists = _h[1];
    useDebounce(function () { return __awaiter(void 0, void 0, void 0, function () {
        var playlists;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getAllPlaylist(searchQuery)];
                case 1:
                    playlists = _a.sent();
                    if (!hasFetched) {
                        setHasFetched(true);
                    }
                    setPlaylists(playlists);
                    setDebouncedSearchQuery(searchQuery);
                    return [2 /*return*/];
            }
        });
    }); }, 350, [forcePlaylistsFetch, searchQuery]);
    var hasPlaylists = playlists && playlists.length > 0;
    var onDismissDelete = function () { return setPlaylistToDelete(undefined); };
    var onDeletePlaylist = function () {
        if (!playlistToDelete) {
            return;
        }
        deletePlaylist(playlistToDelete.id).finally(function () {
            setForcePlaylistsFetch(forcePlaylistsFetch + 1);
            setPlaylistToDelete(undefined);
        });
    };
    var emptyListBanner = (React.createElement(EmptyListCTA, { title: "There are no playlists created yet", buttonIcon: "plus", buttonLink: "playlists/new", buttonTitle: "Create Playlist", proTip: "You can use playlists to cycle dashboards on TVs without user control", proTipLink: "http://docs.grafana.org/reference/playlist/", proTipLinkTitle: "Learn more", proTipTarget: "_blank" }));
    var showSearch = playlists.length > 0 || searchQuery.length > 0 || debouncedSearchQuery.length > 0;
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, { isLoading: !hasFetched },
            showSearch && (React.createElement(PageActionBar, { searchQuery: searchQuery, linkButton: { title: 'New playlist', href: '/playlists/new' }, setSearchQuery: setSearchQuery })),
            !hasPlaylists && searchQuery ? (React.createElement(EmptyQueryListBanner, null)) : (React.createElement(PlaylistPageList, { playlists: playlists, setStartPlaylist: setStartPlaylist, setPlaylistToDelete: setPlaylistToDelete })),
            !showSearch && emptyListBanner,
            playlistToDelete && (React.createElement(ConfirmModal, { title: playlistToDelete.name, confirmText: "Delete", body: "Are you sure you want to delete '" + playlistToDelete.name + "' playlist?", onConfirm: onDeletePlaylist, isOpen: Boolean(playlistToDelete), onDismiss: onDismissDelete })),
            startPlaylist && React.createElement(StartModal, { playlist: startPlaylist, onDismiss: function () { return setStartPlaylist(undefined); } }))));
};
var mapStateToProps = function (state) { return ({
    navModel: getNavModel(state.navIndex, 'playlists'),
}); };
export default connect(mapStateToProps)(PlaylistPage);
//# sourceMappingURL=PlaylistPage.js.map