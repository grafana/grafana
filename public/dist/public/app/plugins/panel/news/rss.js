import { __awaiter, __generator } from "tslib";
export function loadRSSFeed(url) {
    return __awaiter(this, void 0, void 0, function () {
        var rsp, txt, domParser, doc, feed, getProperty;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch(url)];
                case 1:
                    rsp = _a.sent();
                    return [4 /*yield*/, rsp.text()];
                case 2:
                    txt = _a.sent();
                    domParser = new DOMParser();
                    doc = domParser.parseFromString(txt, 'text/xml');
                    feed = {
                        items: [],
                    };
                    getProperty = function (node, property) {
                        var _a;
                        var propNode = node.querySelector(property);
                        if (propNode) {
                            return (_a = propNode.textContent) !== null && _a !== void 0 ? _a : '';
                        }
                        return '';
                    };
                    doc.querySelectorAll('item').forEach(function (node) {
                        var item = {
                            title: getProperty(node, 'title'),
                            link: getProperty(node, 'link'),
                            content: getProperty(node, 'description'),
                            pubDate: getProperty(node, 'pubDate'),
                        };
                        var imageNode = node.querySelector("meta[property='og:image']");
                        if (imageNode) {
                            item.ogImage = imageNode.getAttribute('content');
                        }
                        feed.items.push(item);
                    });
                    return [2 /*return*/, feed];
            }
        });
    });
}
//# sourceMappingURL=rss.js.map