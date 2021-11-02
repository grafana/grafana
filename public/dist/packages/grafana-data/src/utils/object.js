export var objRemoveUndefined = function (obj) {
    return Object.keys(obj).reduce(function (acc, key) {
        if (obj[key] !== undefined) {
            acc[key] = obj[key];
        }
        return acc;
    }, {});
};
//# sourceMappingURL=object.js.map