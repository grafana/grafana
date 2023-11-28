import { __awaiter } from "tslib";
import { parseAtomFeed } from './atom';
import { parseRSSFeed } from './rss';
export function fetchFeedText(url) {
    return __awaiter(this, void 0, void 0, function* () {
        const rsp = yield fetch(url);
        const txt = yield rsp.text();
        return txt;
    });
}
export function isAtomFeed(txt) {
    const domParser = new DOMParser();
    const doc = domParser.parseFromString(txt, 'text/xml');
    return doc.querySelector('feed') !== null;
}
export function getProperty(node, property) {
    var _a;
    const propNode = node.querySelector(property);
    return (_a = propNode === null || propNode === void 0 ? void 0 : propNode.textContent) !== null && _a !== void 0 ? _a : '';
}
export function loadFeed(url) {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield fetchFeedText(url);
        const parsedFeed = isAtomFeed(res) ? parseAtomFeed(res) : parseRSSFeed(res);
        return parsedFeed;
    });
}
//# sourceMappingURL=feed.js.map