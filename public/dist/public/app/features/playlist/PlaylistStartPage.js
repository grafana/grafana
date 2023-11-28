import { playlistSrv } from './PlaylistSrv';
// This is a react page that just redirects to new URLs
export default function PlaylistStartPage({ match }) {
    playlistSrv.start(match.params.uid);
    return null;
}
//# sourceMappingURL=PlaylistStartPage.js.map