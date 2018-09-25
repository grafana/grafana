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
  logos: {
    large: string;
    small: string;
  };
}

export interface PluginInfo {
  author: {
    name: string;
    url: string;
  };
  description: string;
  links: string[];
  logos: { small: string; large: string };
  screenshots: string;
  updated: string;
  version: string;
}

export interface Plugin {
  defaultNavUrl: string;
  enabled: boolean;
  hasUpdate: boolean;
  id: string;
  info: PluginInfo;
  latestVersion: string;
  name: string;
  pinned: boolean;
  state: string;
  type: string;
}

export interface PluginsState {
  plugins: Plugin[];
  searchQuery: string;
  layoutMode: string;
}
