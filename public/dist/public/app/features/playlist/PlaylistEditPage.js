import { __awaiter } from "tslib";
import React from 'react';
import { useAsync } from 'react-use';
import { locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { t, Trans } from 'app/core/internationalization';
import { PlaylistForm } from './PlaylistForm';
import { getPlaylistAPI } from './api';
export const PlaylistEditPage = ({ match }) => {
    const api = getPlaylistAPI();
    const playlist = useAsync(() => api.getPlaylist(match.params.uid), [match.params]);
    const onSubmit = (playlist) => __awaiter(void 0, void 0, void 0, function* () {
        yield api.updatePlaylist(playlist);
        locationService.push('/playlists');
    });
    const pageNav = {
        text: t('playlist-edit.title', 'Edit playlist'),
        subTitle: t('playlist-edit.sub-title', 'A playlist rotates through a pre-selected list of dashboards. A playlist can be a great way to build situational awareness, or just show off your metrics to your team or visitors.'),
    };
    return (React.createElement(Page, { navId: "dashboards/playlists", pageNav: pageNav },
        React.createElement(Page.Contents, { isLoading: playlist.loading },
            playlist.error && (React.createElement("div", null,
                React.createElement(Trans, { i18nKey: "playlist-edit.error-prefix" }, "Error loading playlist:"),
                JSON.stringify(playlist.error))),
            playlist.value && React.createElement(PlaylistForm, { onSubmit: onSubmit, playlist: playlist.value }))));
};
export default PlaylistEditPage;
//# sourceMappingURL=PlaylistEditPage.js.map