import { config } from '@grafana/runtime';

import { sandboxPluginDependencies } from '../sandbox/plugin_dependencies';

import { SHARED_DEPENDENCY_PREFIX } from './constants';
import { trackPackageUsage } from './packageMetrics';
import { SystemJS } from './systemjs';

export function buildImportMap(importMap: Record<string, System.Module>) {
  return Object.keys(importMap).reduce<Record<string, string>>((acc, key) => {
    // Use the 'package:' prefix to act as a URL instead of a bare specifier
    const module_name = `${SHARED_DEPENDENCY_PREFIX}:${key}`;

    // get the module to use
    const module = config.featureToggles.pluginsAPIMetrics ? trackPackageUsage(importMap[key], key) : importMap[key];

    // expose dependency to SystemJS
    SystemJS.set(module_name, module);

    // expose dependency to sandboxed plugins
    // the sandbox handles its own way of plugins api metrics
    sandboxPluginDependencies.set(key, importMap[key]);

    acc[key] = module_name;
    return acc;
  }, {});
}

export function isHostedOnCDN(path: string) {
  return Boolean(config.pluginsCDNBaseURL) && path.startsWith(config.pluginsCDNBaseURL);
}

// This function is used to dynamically prepend the appSubUrl in the frontend.
// This is required because if serve_from_sub_path is false the Image Renderer sets the subpath
// to an empty string and sets appurl to localhost which causes plugins to fail to load.
// https://github.com/grafana/grafana/issues/76180
export function resolveModulePath(path: string) {
  if (path.startsWith('http') || path.startsWith('/')) {
    return path;
  }

  return `${config.appSubUrl ?? ''}/${path}`;
}
