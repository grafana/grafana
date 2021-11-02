var context = document.createElement('canvas').getContext('2d');
var cache = new Map();
var cacheLimit = 500;
var ctxFontStyle = '';
/**
 * @internal
 */
export function getCanvasContext() {
    return context;
}
/**
 * @beta
 */
export function measureText(text, fontSize) {
    var fontStyle = fontSize + "px 'Roboto'";
    var cacheKey = text + fontStyle;
    var fromCache = cache.get(cacheKey);
    if (fromCache) {
        return fromCache;
    }
    if (ctxFontStyle !== fontStyle) {
        context.font = ctxFontStyle = fontStyle;
    }
    var metrics = context.measureText(text);
    if (cache.size === cacheLimit) {
        cache.clear();
    }
    cache.set(cacheKey, metrics);
    return metrics;
}
/**
 * @beta
 */
export function calculateFontSize(text, width, height, lineHeight, maxSize) {
    // calculate width in 14px
    var textSize = measureText(text, 14);
    // how much bigger than 14px can we make it while staying within our width constraints
    var fontSizeBasedOnWidth = (width / (textSize.width + 2)) * 14;
    var fontSizeBasedOnHeight = height / lineHeight;
    // final fontSize
    var optimalSize = Math.min(fontSizeBasedOnHeight, fontSizeBasedOnWidth);
    return Math.min(optimalSize, maxSize !== null && maxSize !== void 0 ? maxSize : optimalSize);
}
//# sourceMappingURL=measureText.js.map