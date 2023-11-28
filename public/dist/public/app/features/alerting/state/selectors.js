export const getSearchQuery = (state) => state.searchQuery;
export const getAlertRuleItems = (state) => {
    const regex = new RegExp(state.alertRules.searchQuery, 'i');
    return state.alertRules.items.filter((item) => {
        return regex.test(item.name) || regex.test(item.stateText) || regex.test(item.info);
    });
};
export const getNotificationChannel = (state, channelId) => {
    if (state.notificationChannel.id === channelId) {
        return state.notificationChannel;
    }
    return null;
};
//# sourceMappingURL=selectors.js.map