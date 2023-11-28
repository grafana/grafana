import { getProperty } from './feed';
export function parseRSSFeed(txt) {
    const domParser = new DOMParser();
    const doc = domParser.parseFromString(txt, 'text/xml');
    const feed = {
        items: Array.from(doc.querySelectorAll('item')).map((node) => {
            var _a;
            return ({
                title: getProperty(node, 'title'),
                link: getProperty(node, 'link'),
                content: getProperty(node, 'description'),
                pubDate: getProperty(node, 'pubDate'),
                ogImage: (_a = node.querySelector("meta[property='og:image']")) === null || _a === void 0 ? void 0 : _a.getAttribute('content'),
            });
        }),
    };
    return feed;
}
//# sourceMappingURL=rss.js.map