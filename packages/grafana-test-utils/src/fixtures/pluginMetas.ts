export interface MockPluginMetaInclude {
  type?: 'dashboard' | 'page' | 'panel' | 'datasource';
  name?: string;
  path?: string;
  icon?: string;
  role?: 'Admin' | 'Editor' | 'Viewer' | 'None';
  action?: string;
  addToNav?: boolean;
  defaultNav?: boolean;
  uid?: string;
  component?: string;
}

export interface MockPluginMetaOptions {
  type?: 'app' | 'datasource' | 'panel' | 'renderer';
  includes?: MockPluginMetaInclude[];
  description?: string;
  logos?: { small: string; large: string };
}

/** Builds a minimal plugins.grafana.app Meta object for the metas endpoint */
export const mockPluginMeta = (id: string, name: string, options: MockPluginMetaOptions = {}) => {
  const {
    type = 'app',
    includes = [],
    description = name,
    logos = { small: `/plugins/${id}/small.svg`, large: `/plugins/${id}/large.svg` },
  } = options;

  return {
    apiVersion: 'plugins.grafana.app/v0alpha1',
    kind: 'Meta',
    metadata: { name: id },
    spec: {
      pluginJson: {
        id,
        name,
        type,
        info: { logos, description, keywords: [], updated: '', version: '1.0.0' },
        includes,
        dependencies: { grafanaDependency: '*' },
      },
      class: 'external',
      module: { path: `public/plugins/${id}/module.js`, loadingStrategy: 'fetch' },
      baseURL: `public/plugins/${id}`,
      signature: { status: 'valid' },
    },
  };
};

export type MockPluginMeta = ReturnType<typeof mockPluginMeta>;

// No plugins are installed by default
export const mockPluginMetasStore: MockPluginMeta[] = [];

/**
 * Seed the plugin metas served by the plugins.grafana.app metas endpoint for a
 * test (replaces the current set). Build entries with {@link mockPluginMeta}.
 */
export const setMockPluginMetas = (metas: MockPluginMeta[]) => {
  mockPluginMetasStore.length = 0;
  mockPluginMetasStore.push(...metas);
};
