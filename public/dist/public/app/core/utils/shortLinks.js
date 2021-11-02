import { __awaiter, __generator } from "tslib";
import memoizeOne from 'memoize-one';
import { getBackendSrv, config } from '@grafana/runtime';
import { copyStringToClipboard } from './explore';
import { dispatch } from 'app/store/store';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
function buildHostUrl() {
    return window.location.protocol + "//" + window.location.host + config.appSubUrl;
}
function getRelativeURLPath(url) {
    var path = url.replace(buildHostUrl(), '');
    return path.startsWith('/') ? path.substring(1, path.length) : path;
}
export var createShortLink = memoizeOne(function (path) {
    return __awaiter(this, void 0, void 0, function () {
        var shortLink, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getBackendSrv().post("/api/short-urls", {
                            path: getRelativeURLPath(path),
                        })];
                case 1:
                    shortLink = _a.sent();
                    return [2 /*return*/, shortLink.url];
                case 2:
                    err_1 = _a.sent();
                    console.error('Error when creating shortened link: ', err_1);
                    dispatch(notifyApp(createErrorNotification('Error generating shortened link')));
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
});
export var createAndCopyShortLink = function (path) { return __awaiter(void 0, void 0, void 0, function () {
    var shortLink;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, createShortLink(path)];
            case 1:
                shortLink = _a.sent();
                if (shortLink) {
                    copyStringToClipboard(shortLink);
                    dispatch(notifyApp(createSuccessNotification('Shortened link copied to clipboard')));
                }
                else {
                    dispatch(notifyApp(createErrorNotification('Error generating shortened link')));
                }
                return [2 /*return*/];
        }
    });
}); };
//# sourceMappingURL=shortLinks.js.map