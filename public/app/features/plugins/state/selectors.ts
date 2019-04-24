export const getPlugins = state => {
  const regex = new RegExp(state.searchQuery, 'i');

  return state.plugins.filter(item => {
    return regex.test(item.name) || regex.test(item.info.author.name) || regex.test(item.info.description);
  });
};

export const getPluginsSearchQuery = state => state.searchQuery;
export const getLayoutMode = state => state.layoutMode;
