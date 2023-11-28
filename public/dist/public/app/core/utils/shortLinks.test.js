import { __awaiter } from "tslib";
import { createShortLink, createAndCopyShortLink } from './shortLinks';
jest.mock('@grafana/runtime', () => ({
    getBackendSrv: () => {
        return {
            post: () => {
                return Promise.resolve({ url: 'www.short.com' });
            },
        };
    },
    config: {
        appSubUrl: '',
    },
}));
describe('createShortLink', () => {
    it('creates short link', () => __awaiter(void 0, void 0, void 0, function* () {
        const shortUrl = yield createShortLink('www.verylonglinkwehavehere.com');
        expect(shortUrl).toBe('www.short.com');
    }));
});
describe('createAndCopyShortLink', () => {
    it('copies short link to clipboard', () => __awaiter(void 0, void 0, void 0, function* () {
        document.execCommand = jest.fn();
        yield createAndCopyShortLink('www.verylonglinkwehavehere.com');
        expect(document.execCommand).toHaveBeenCalledWith('copy');
    }));
});
//# sourceMappingURL=shortLinks.test.js.map