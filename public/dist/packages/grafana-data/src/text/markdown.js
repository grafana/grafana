import marked from 'marked';
import { sanitize } from './sanitize';
var hasInitialized = false;
export function renderMarkdown(str, options) {
    if (!hasInitialized) {
        marked.setOptions({
            pedantic: false,
            gfm: true,
            smartLists: true,
            smartypants: false,
            xhtml: false,
        });
        hasInitialized = true;
    }
    var html = marked(str || '');
    if (options === null || options === void 0 ? void 0 : options.noSanitize) {
        return html;
    }
    return sanitize(html);
}
//# sourceMappingURL=markdown.js.map