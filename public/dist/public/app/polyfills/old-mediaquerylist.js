// Safari < 14 does not have mql.addEventListener(), but uses the old spec mql.addListener()
var oMatchMedia = window.matchMedia;
window.matchMedia = function (mediaQueryString) {
    var mql = oMatchMedia(mediaQueryString);
    if (!mql.addEventListener) {
        // @ts-ignore
        mql.addEventListener = function (type, listener) {
            mql.addListener(listener);
        };
        // @ts-ignore
        mql.removeEventListener = function (type, listener) {
            mql.removeListener(listener);
        };
    }
    return mql;
};
//# sourceMappingURL=old-mediaquerylist.js.map