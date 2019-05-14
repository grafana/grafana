import config from 'app/core/config';
export var stripBaseFromUrl = function (url) {
    var appSubUrl = config.appSubUrl;
    var stripExtraChars = appSubUrl.endsWith('/') ? 1 : 0;
    var urlWithoutBase = url.length > 0 && url.indexOf(appSubUrl) === 0 ? url.slice(appSubUrl.length - stripExtraChars) : url;
    return urlWithoutBase;
};
export default { stripBaseFromUrl: stripBaseFromUrl };
//# sourceMappingURL=location_util.js.map