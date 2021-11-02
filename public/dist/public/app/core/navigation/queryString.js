export var queryString = function (params) {
    return Object.keys(params)
        .filter(function (k) {
        return !!params[k];
    })
        .map(function (k) {
        return k + '=' + params[k];
    })
        .join('&');
};
//# sourceMappingURL=queryString.js.map