// Slightly modified, but without dependancies:
// https://raw.githubusercontent.com/malte-wessel/react-custom-scrollbars/master/src/utils/getScrollbarWidth.js
var scrollbarWidth = null;
export default function getScrollbarWidth() {
    if (scrollbarWidth !== null) {
        return scrollbarWidth;
    }
    if (typeof document !== 'undefined') {
        var div_1 = document.createElement('div');
        var newStyles_1 = {
            width: '100px',
            height: '100px',
            position: 'absolute',
            top: '-9999px',
            overflow: 'scroll',
            MsOverflowStyle: 'scrollbar',
        };
        Object.keys(newStyles_1).map(function (style) {
            div_1.style[style] = newStyles_1[style];
        });
        document.body.appendChild(div_1);
        scrollbarWidth = div_1.offsetWidth - div_1.clientWidth;
        document.body.removeChild(div_1);
    }
    else {
        scrollbarWidth = 0;
    }
    return scrollbarWidth || 0;
}
var hasNoOverlayScrollbars = getScrollbarWidth() > 0;
export var addClassIfNoOverlayScrollbar = function (classname, htmlElement) {
    if (htmlElement === void 0) { htmlElement = document.body; }
    if (hasNoOverlayScrollbars) {
        htmlElement.classList.add(classname);
    }
};
//# sourceMappingURL=scrollbar.js.map