export interface PluginMeta {
  id: string;
  name: string;
  info: PluginMetaInfo;
  includes: PluginInclude[];
}

export interface PluginInclude {
  type: string;
  name: string;
  path: string;
}

export interface PluginMetaInfo {
  author: {
    name: string;
    url: string;
  };
  description: string;
  links: string[];
  logos: {
    large: string;
    small: string;
  };
  screenshots: string;
  updated: string;
  version: string;
}

export interface PluginListItem {
  defaultNavUrl: string;
  enabled: boolean;
  hasUpdate: boolean;
  id: string;
  info: PluginMetaInfo;
  latestVersion: string;
  name: string;
  pinned: boolean;
  state: string;
  type: string;
}

export interface PluginsState {
  plugins: PluginListItem[];
  searchQuery: string;
  layoutMode: string;
}
