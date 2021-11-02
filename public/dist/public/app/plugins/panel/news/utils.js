import { __values } from "tslib";
import { ArrayVector, FieldType, dateTime } from '@grafana/data';
export function feedToDataFrame(feed) {
    var e_1, _a;
    var date = new ArrayVector([]);
    var title = new ArrayVector([]);
    var link = new ArrayVector([]);
    var content = new ArrayVector([]);
    var ogImage = new ArrayVector([]);
    try {
        for (var _b = __values(feed.items), _c = _b.next(); !_c.done; _c = _b.next()) {
            var item = _c.value;
            var val = dateTime(item.pubDate);
            try {
                date.buffer.push(val.valueOf());
                title.buffer.push(item.title);
                link.buffer.push(item.link);
                ogImage.buffer.push(item.ogImage);
                if (item.content) {
                    var body = item.content.replace(/<\/?[^>]+(>|$)/g, '');
                    content.buffer.push(body);
                }
            }
            catch (err) {
                console.warn('Error reading news item:', err, item);
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
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