export var getSearchQuery = function (state) { return state.searchQuery; };
export var getAlertRuleItems = function (state) {
    var regex = new RegExp(state.alertRules.searchQuery, 'i');
    return state.alertRules.items.filter(function (item) {
        return regex.test(item.name) || regex.test(item.stateText) || regex.test(item.info);
    });
};
export var getNotificationChannel = function (state, channelId) {
    if (state.notificationChannel.id === channelId) {
        return state.notificationChannel;
    }
    return null;
};
//# sourceMappingURL=selectors.js.map