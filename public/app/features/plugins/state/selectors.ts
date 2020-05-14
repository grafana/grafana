import { PluginsState } from 'app/types/plugins';

export const getPlugins = (state: PluginsState) => {
  const regex = new RegExp(state.searchQuery, 'i');

  return state.plugins.filter(item => {
    return regex.test(item.name) || regex.test(item.info.author.name) || regex.test(item.info.description);
  });
};

export const getPluginsSearchQuery = (state: PluginsState) => state.searchQuery;
