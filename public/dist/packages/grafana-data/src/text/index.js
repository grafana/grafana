export * from './string';
export * from './markdown';
export * from './text';
import { escapeHtml, hasAnsiCodes, sanitize, sanitizeUrl } from './sanitize';
export var textUtil = {
    escapeHtml: escapeHtml,
    hasAnsiCodes: hasAnsiCodes,
    sanitize: sanitize,
    sanitizeUrl: sanitizeUrl,
};
//# sourceMappingURL=index.js.map