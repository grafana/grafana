export enum PluginState {
  alpha = 'alpha',
  beta = 'beta',
}

export function getPluginStateInfoText(state?: PluginState): string | null {
  switch (state) {
    case PluginState.alpha:
      return (
        'This plugin is marked as being in alpha state, which means it is in early development phase and updates' +
        ' will include breaking changes.'
      );

    case PluginState.beta:
      return (
        'This plugin is marked as being in a beta development state. This means it is in currently in active' +
        ' development and could be missing important features.'
      );
  }
  return null;
}

export interface PluginMeta {
  id: string;
  name: string;
  info: PluginMetaInfo;
  includes: PluginInclude[];
  module: string;
  baseUrl: string;

  type: string;
  enabled?: boolean;
  state?: PluginState;

  // Datasource-specific
  builtIn?: boolean;
  metrics?: boolean;
  tables?: boolean;
  logs?: boolean;
  explore?: boolean;
  annotations?: boolean;
  mixed?: boolean;
  hasQueryHelp?: boolean;
  queryOptions?: PluginMetaQueryOptions;
}

interface PluginMetaQueryOptions {
  cacheTimeout?: boolean;
  maxDataPoints?: boolean;
  minInterval?: boolean;
}

export interface PluginInclude {
  type: string;
  name: string;
  path: string;
}

interface PluginMetaInfoLink {
  name: string;
  url: string;
}

export interface PluginMetaInfo {
  author: {
    name: string;
    url?: string;
  };
  description: string;
  links: PluginMetaInfoLink[];
  logos: {
    large: string;
    small: string;
  };
  screenshots: any[];
  updated: string;
  version: string;
}
