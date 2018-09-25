export const getPlugins = state => {
  const regex = new RegExp(state.searchQuery, 'i');

  return state.plugins.filter(item => {
    return regex.test(item.name);
  });
};

export const getPluginsSearchQuery = state => state.searchQuery;
export const getLayoutMode = state => state.layoutMode;
