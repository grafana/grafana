export var getSearchQuery = function (state) { return state.searchQuery; };
export var getAlertRuleItems = function (state) {
    var regex = new RegExp(state.searchQuery, 'i');
    return state.items.filter(function (item) {
        return regex.test(item.name) || regex.test(item.stateText) || regex.test(item.info);
    });
};
//# sourceMappingURL=selectors.js.map