export var getApiKeysCount = function (state) { return state.keys.length; };
export var getApiKeys = function (state) {
    var regex = RegExp(state.searchQuery, 'i');
    return state.keys.filter(function (key) {
        return regex.test(key.name) || regex.test(key.role);
    });
};
//# sourceMappingURL=selectors.js.map