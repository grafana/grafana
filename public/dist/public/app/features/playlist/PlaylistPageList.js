import React from 'react';
import { Button, Card, LinkButton } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
export var PlaylistPageList = function (_a) {
    var playlists = _a.playlists, setStartPlaylist = _a.setStartPlaylist, setPlaylistToDelete = _a.setPlaylistToDelete;
    return (React.createElement(React.Fragment, null, playlists.map(function (playlist) { return (React.createElement(Card, { heading: playlist.name, key: playlist.id.toString() },
        React.createElement(Card.Actions, null,
            React.createElement(Button, { variant: "secondary", icon: "play", onClick: function () { return setStartPlaylist(playlist); } }, "Start playlist"),
            contextSrv.isEditor && (React.createElement(React.Fragment, null,
                React.createElement(LinkButton, { key: "edit", variant: "secondary", href: "/playlists/edit/" + playlist.id, icon: "cog" }, "Edit playlist"),
                React.createElement(Button, { disabled: false, onClick: function () { return setPlaylistToDelete({ id: playlist.id, name: playlist.name }); }, icon: "trash-alt", variant: "destructive" }, "Delete playlist")))))); })));
};
//# sourceMappingURL=PlaylistPageList.js.map