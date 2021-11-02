// Slightly modified, but without dependancies:
// https://raw.githubusercontent.com/malte-wessel/react-custom-scrollbars/master/src/utils/getScrollbarWidth.js
var scrollbarWidth = null;
export function getScrollbarWidth() {
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
            // @ts-ignore
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
//# sourceMappingURL=scrollbar.js.map