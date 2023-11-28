import { __awaiter } from "tslib";
import memoizeOne from 'memoize-one';
import { getBackendSrv, config } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { dispatch } from 'app/store/store';
import { copyStringToClipboard } from './explore';
function buildHostUrl() {
    return `${window.location.protocol}//${window.location.host}${config.appSubUrl}`;
}
function getRelativeURLPath(url) {
    let path = url.replace(buildHostUrl(), '');
    return path.startsWith('/') ? path.substring(1, path.length) : path;
}
export const createShortLink = memoizeOne(function (path) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const shortLink = yield getBackendSrv().post(`/api/short-urls`, {
                path: getRelativeURLPath(path),
            });
            return shortLink.url;
        }
        catch (err) {
            console.error('Error when creating shortened link: ', err);
            dispatch(notifyApp(createErrorNotification('Error generating shortened link')));
        }
    });
});
export const createAndCopyShortLink = (path) => __awaiter(void 0, void 0, void 0, function* () {
    const shortLink = yield createShortLink(path);
    if (shortLink) {
        copyStringToClipboard(shortLink);
        dispatch(notifyApp(createSuccessNotification('Shortened link copied to clipboard')));
    }
    else {
        dispatch(notifyApp(createErrorNotification('Error generating shortened link')));
    }
});
//# sourceMappingURL=shortLinks.js.map