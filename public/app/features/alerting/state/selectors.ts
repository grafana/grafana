export const getSearchQuery = state => state.searchQuery;

export const getAlertRuleItems = state => {
  const regex = new RegExp(state.searchQuery, 'i');

  return state.items.filter(item => {
    return regex.test(item.name) || regex.test(item.stateText) || regex.test(item.info);
  });
};
