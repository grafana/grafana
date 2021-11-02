import { __awaiter, __generator } from "tslib";
import React from 'react';
import { connect } from 'react-redux';
import { locationService } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { PlaylistForm } from './PlaylistForm';
import { updatePlaylist } from './api';
import { usePlaylist } from './usePlaylist';
import { getPlaylistStyles } from './styles';
export var PlaylistEditPage = function (_a) {
    var navModel = _a.navModel, match = _a.match;
    var styles = useStyles2(getPlaylistStyles);
    var _b = usePlaylist(match.params.id), playlist = _b.playlist, loading = _b.loading;
    var onSubmit = function (playlist) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, updatePlaylist(match.params.id, playlist)];
                case 1:
                    _a.sent();
                    locationService.push('/playlists');
                    return [2 /*return*/];
            }
        });
    }); };
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, { isLoading: loading },
            React.createElement("h3", { className: styles.subHeading }, "Edit playlist"),
            React.createElement("p", { className: styles.description }, "A playlist rotates through a pre-selected list of dashboards. A playlist can be a great way to build situational awareness, or just show off your metrics to your team or visitors."),
            React.createElement(PlaylistForm, { onSubmit: onSubmit, playlist: playlist }))));
};
var mapStateToProps = function (state) { return ({
    navModel: getNavModel(state.navIndex, 'playlists'),
}); };
export default connect(mapStateToProps)(PlaylistEditPage);
//# sourceMappingURL=PlaylistEditPage.js.map