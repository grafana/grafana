export var getPlugins = function (state) {
    var regex = new RegExp(state.searchQuery, 'i');
    return state.plugins.filter(function (item) {
        return regex.test(item.name) || regex.test(item.info.author.name) || regex.test(item.info.description);
    });
};
export var getPluginsSearchQuery = function (state) { return state.searchQuery; };
export var getLayoutMode = function (state) { return state.layoutMode; };
//# sourceMappingURL=selectors.js.map