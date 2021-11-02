import { playlistSrv } from './PlaylistSrv';
export var PlaylistStartPage = function (_a) {
    var match = _a.match;
    playlistSrv.start(parseInt(match.params.id, 10));
    return null;
};
export default PlaylistStartPage;
//# sourceMappingURL=PlaylistStartPage.js.map