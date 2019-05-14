// Based on underscore.js debounce()
export default function debounce(func, wait) {
    var timeout;
    return function () {
        var context = this;
        var args = arguments;
        var later = function () {
            timeout = null;
            func.apply(context, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
//# sourceMappingURL=debounce.js.map