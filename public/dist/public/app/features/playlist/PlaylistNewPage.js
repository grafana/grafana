import { __awaiter } from "tslib";
import React, { useState } from 'react';
import { locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { PlaylistForm } from './PlaylistForm';
import { getPlaylistAPI, getDefaultPlaylist } from './api';
export const PlaylistNewPage = () => {
    const [playlist] = useState(getDefaultPlaylist());
    const onSubmit = (playlist) => __awaiter(void 0, void 0, void 0, function* () {
        yield getPlaylistAPI().createPlaylist(playlist);
        locationService.push('/playlists');
    });
    const pageNav = {
        text: 'New playlist',
        subTitle: 'A playlist rotates through a pre-selected list of dashboards. A playlist can be a great way to build situational awareness, or just show off your metrics to your team or visitors.',
    };
    return (React.createElement(Page, { navId: "dashboards/playlists", pageNav: pageNav },
        React.createElement(Page.Contents, null,
            React.createElement(PlaylistForm, { onSubmit: onSubmit, playlist: playlist }))));
};
export default PlaylistNewPage;
//# sourceMappingURL=PlaylistNewPage.js.map