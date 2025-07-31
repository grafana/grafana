/**
 * Map with all dependencies that are exposed to plugins sandbox
 * e.g.: @grafana/ui, @grafana/data, etc...
 */
export const sandboxPluginDependencies = new Map<string, System.Module | (() => Promise<System.Module>)>([]);
