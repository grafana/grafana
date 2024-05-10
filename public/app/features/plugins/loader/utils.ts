import { config } from '@grafana/runtime';

import { SHARED_DEPENDENCY_PREFIX } from './constants';
import { SystemJS } from './systemjs';

export function buildImportMap(importMap: Record<string, System.Module>) {
  return Object.keys(importMap).reduce<Record<string, string>>((acc, key) => {
    // Use the 'package:' prefix to act as a URL instead of a bare specifier
    const module_name = `${SHARED_DEPENDENCY_PREFIX}:${key}`;

    // expose dependency to loaders
    addPreload(module_name, importMap[key]);

    acc[key] = module_name;
    return acc;
  }, {});
}

// TODO: Figure out dynamic fe sandbox dependencies... maybe we can use define here instead?
function addPreload(id: string, preload: (() => Promise<System.Module>) | System.Module) {
  if (SystemJS.has(id)) {
    return false;
  }

  let resolvedId;
  try {
    resolvedId = SystemJS.resolve(id);
  } catch (e) {
    console.log(e);
  }

  if (resolvedId && SystemJS.has(resolvedId)) {
    return false;
  }

  const moduleId = resolvedId || id;
  if (typeof preload === 'function') {
    SystemJS.register(id, [], (_export) => {
      return {
        execute: async function () {
          const module = await preload();
          _export(module);
        },
      };
    });
    return true;
  }

  SystemJS.set(moduleId, preload);

  return true;
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
