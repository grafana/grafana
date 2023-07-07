import { SystemJS } from '@grafana/runtime';

import { sandboxPluginDependencies } from '../sandbox/plugin_dependencies';

import { ENDS_WITH_FILE_EXTENSION_REGEX, SHARED_DEPENDENCY_PREFIX } from './constants';

export function buildImportMap(importMap: Record<string, System.Module>) {
  return Object.keys(importMap).reduce<Record<string, string>>((acc, key) => {
    // Use the 'package:' prefix to act as a URL instead of a bare specifier
    const module_name = `${SHARED_DEPENDENCY_PREFIX}:${key}`;
    // expose dependency to SystemJS
    SystemJS.set(module_name, importMap[key]);

    // expose dependency to sandboxed plugins
    sandboxPluginDependencies.set(key, importMap[key]);

    acc[key] = module_name;
    return acc;
  }, {});
}

// This function handles the following legacy SystemJS functionality:
// - strips legacy loader wildcard from urls
// - prepends `SHARED_DEPENDENCY_PREFIX` to correctly resolve `app` imports in old angular plugins
// - support config.defaultExtension for System.register deps that lack an extension (e.g. './my_ctrl')
export function getBackWardsCompatibleUrl(url: string) {
  if (url.endsWith('!')) {
    url = url.slice(0, -1);
  }

  const shouldAddDefaultExtension =
    !url.startsWith(`${SHARED_DEPENDENCY_PREFIX}:`) && !ENDS_WITH_FILE_EXTENSION_REGEX.test(url);
  return shouldAddDefaultExtension ? url + '.js' : url;
}

// This transform prevents a conflict between systemjs and requirejs which Monaco Editor
// depends on. See packages/grafana-runtime/src/utils/plugin.ts for more.
export function preventAMDLoaderCollision(source: string) {
  return `(function(define) {
    ${source}
  })(System.define);`;
}
