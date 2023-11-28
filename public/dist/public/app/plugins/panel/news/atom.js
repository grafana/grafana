import { getProperty } from './feed';
export function parseAtomFeed(txt) {
    const domParser = new DOMParser();
    const doc = domParser.parseFromString(txt, 'text/xml');
    const feed = {
        items: Array.from(doc.querySelectorAll('entry')).map((node) => {
            var _a, _b, _c;
            return ({
                title: getProperty(node, 'title'),
                link: (_b = (_a = node.querySelector('link')) === null || _a === void 0 ? void 0 : _a.getAttribute('href')) !== null && _b !== void 0 ? _b : '',
                content: getProperty(node, 'content'),
                pubDate: getProperty(node, 'published'),
                ogImage: (_c = node.querySelector("meta[property='og:image']")) === null || _c === void 0 ? void 0 : _c.getAttribute('content'),
            });
        }),
    };
    return feed;
}
//# sourceMappingURL=atom.js.map