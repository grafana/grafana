import { __awaiter, __generator } from "tslib";
import { createShortLink, createAndCopyShortLink } from './shortLinks';
jest.mock('@grafana/runtime', function () { return ({
    getBackendSrv: function () {
        return {
            post: function () {
                return Promise.resolve({ url: 'www.short.com' });
            },
        };
    },
    config: {
        appSubUrl: '',
    },
}); });
describe('createShortLink', function () {
    it('creates short link', function () { return __awaiter(void 0, void 0, void 0, function () {
        var shortUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, createShortLink('www.verylonglinkwehavehere.com')];
                case 1:
                    shortUrl = _a.sent();
                    expect(shortUrl).toBe('www.short.com');
                    return [2 /*return*/];
            }
        });
    }); });
});
describe('createAndCopyShortLink', function () {
    it('copies short link to clipboard', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    document.execCommand = jest.fn();
                    return [4 /*yield*/, createAndCopyShortLink('www.verylonglinkwehavehere.com')];
                case 1:
                    _a.sent();
                    expect(document.execCommand).toHaveBeenCalledWith('copy');
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=shortLinks.test.js.map