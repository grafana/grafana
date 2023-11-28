import { FieldType, dateTime } from '@grafana/data';
export function feedToDataFrame(feed) {
    const date = [];
    const title = [];
    const link = [];
    const content = [];
    const ogImage = [];
    for (const item of feed.items) {
        const val = dateTime(item.pubDate);
        try {
            date.push(val.valueOf());
            title.push(item.title);
            link.push(item.link);
            ogImage.push(item.ogImage);
            if (item.content) {
                const body = item.content.replace(/<\/?[^>]+(>|$)/g, '');
                content.push(body);
            }
        }
        catch (err) {
            console.warn('Error reading news item:', err, item);
        }
    }
    return {
        fields: [
            { name: 'date', type: FieldType.time, config: { displayName: 'Date' }, values: date },
            { name: 'title', type: FieldType.string, config: {}, values: title },
            { name: 'link', type: FieldType.string, config: {}, values: link },
            { name: 'content', type: FieldType.string, config: {}, values: content },
            { name: 'ogImage', type: FieldType.string, config: {}, values: ogImage },
        ],
        length: date.length,
    };
}
//# sourceMappingURL=utils.js.map