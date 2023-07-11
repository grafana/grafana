import createVirtualEnvironment from '@locker/near-membrane-dom';
import { ProxyTarget } from '@locker/near-membrane-shared';

import { PluginMeta } from '@grafana/data';

import { extractPluginIdVersionFromUrl, getPluginCdnResourceUrl, transformPluginSourceForCDN } from '../cdn/utils';
import { PLUGIN_CDN_URL_KEY } from '../constants';
import { getPluginSettings } from '../pluginSettings';

import { getGeneralSandboxDistortionMap } from './distortion_map';
import {
  getSafeSandboxDomElement,
  isDomElement,
  isLiveTarget,
  markDomElementStyleAsALiveTarget,
  patchObjectAsLiveTarget,
} from './document_sandbox';
import { sandboxPluginDependencies } from './plugin_dependencies';
import { sandboxPluginComponents } from './sandbox_components';
import { CompartmentDependencyModule, PluginFactoryFunction } from './types';
import { logError } from './utils';

// Loads near membrane custom formatter for near membrane proxy objects.
if (process.env.NODE_ENV !== 'production') {
  require('@locker/near-membrane-dom/custom-devtools-formatter');
}

const pluginImportCache = new Map<string, Promise<unknown>>();

export async function importPluginModuleInSandbox({ pluginId }: { pluginId: string }): Promise<unknown> {
  try {
    const pluginMeta = await getPluginSettings(pluginId);
    if (!pluginImportCache.has(pluginId)) {
      pluginImportCache.set(pluginId, doImportPluginModuleInSandbox(pluginMeta));
    }
    return pluginImportCache.get(pluginId);
  } catch (e) {
    const error = new Error(`Could not import plugin ${pluginId} inside sandbox: ` + e);
    logError(error, {
      pluginId,
      error: String(e),
    });
    throw error;
  }
}

async function doImportPluginModuleInSandbox(meta: PluginMeta): Promise<unknown> {
  const generalDistortionMap = getGeneralSandboxDistortionMap();

  /*
   * this function is executed every time a plugin calls any DOM API
   * it must be kept as lean and performant as possible and sync
   */
  function distortionCallback(originalValue: ProxyTarget): ProxyTarget {
    if (isDomElement(originalValue)) {
      const element = getSafeSandboxDomElement(originalValue, meta.id);
      // the element.style attribute should be a live target to work in chrome
      markDomElementStyleAsALiveTarget(element);
      return element;
    } else {
      patchObjectAsLiveTarget(originalValue);
    }
    const distortion = generalDistortionMap.get(originalValue);
    if (distortion) {
      return distortion(originalValue, meta.id) as ProxyTarget;
    }
    return originalValue;
  }

  return new Promise(async (resolve, reject) => {
    // each plugin has its own sandbox
    const sandboxEnvironment = createVirtualEnvironment(window, {
      // distortions are interceptors to modify the behavior of objects when
      // the code inside the sandbox tries to access them
      distortionCallback,
      liveTargetCallback: isLiveTarget,
      // endowments are custom variables we make available to plugins in their window object
      endowments: Object.getOwnPropertyDescriptors({
        // Plugins builds use the AMD module system. Their code consists
        // of a single function call to `define()` that internally contains all the plugin code.
        // This is that `define` function the plugin will call.
        // More info about how AMD works https://github.com/amdjs/amdjs-api/blob/master/AMD.md
        // Plugins code normally use the "anonymous module" signature: define(depencies, factoryFunction)
        async define(
          idOrDependencies: string | string[],
          maybeDependencies: string[] | PluginFactoryFunction,
          maybeFactory?: PluginFactoryFunction
        ): Promise<void> {
          let dependencies: string[];
          let factory: PluginFactoryFunction;
          if (Array.isArray(idOrDependencies)) {
            dependencies = idOrDependencies;
            factory = maybeDependencies as PluginFactoryFunction;
          } else {
            dependencies = maybeDependencies as string[];
            factory = maybeFactory!;
          }

          try {
            const resolvedDeps = resolvePluginDependencies(dependencies);
            // execute the plugin's code
            const pluginExportsRaw = factory.apply(null, resolvedDeps);
            // only after the plugin has been executed
            // we can return the plugin exports.
            // This is what grafana effectively gets.
            const pluginExports = await sandboxPluginComponents(pluginExportsRaw, meta);
            resolve(pluginExports);
          } catch (e) {
            const error = new Error(`Could not execute plugin's define ${meta.id}: ` + e);
            logError(error, {
              pluginId: meta.id,
              error: String(e),
            });
            reject(error);
          }
        },
      }),
      // This improves the error message output for plugins
      // because errors thrown inside of the sandbox have a stack
      // trace that is difficult to read due to all the sandboxing
      // layers.
      instrumentation: {
        // near-membrane concept of "activity" is something that happens inside
        // the plugin instrumentation
        startActivity() {
          return {
            stop: () => {},
            error: getActivityErrorHandler(meta.id),
          };
        },
        log: () => {},
        error: () => {},
      },
    });

    // fetch plugin's code
    let pluginCode = '';
    try {
      pluginCode = await getPluginCode(meta);
    } catch (e) {
      throw new Error(`Could not load plugin ${meta.id}: ` + e);
      reject(new Error(`Could not load plugin ${meta.id}: ` + e));
    }

    try {
      // runs the code inside the sandbox environment
      // this evaluate will eventually run the `define` function inside
      // of endowments.
      sandboxEnvironment.evaluate(pluginCode);
    } catch (e) {
      const error = new Error(`Could not run plugin ${meta.id} inside sandbox: ` + e);
      logError(error, {
        pluginId: meta.id,
        error: String(e),
      });
      reject(error);
    }
  });
}

async function getPluginCode(meta: PluginMeta): Promise<string> {
  if (meta.module.includes(`${PLUGIN_CDN_URL_KEY}/`)) {
    // should load plugin from a CDN
    const pluginUrl = getPluginCdnResourceUrl(`/public/${meta.module}`) + '.js';
    const response = await fetch(pluginUrl);
    let pluginCode = await response.text();
    const { version } = extractPluginIdVersionFromUrl(pluginUrl);
    pluginCode = transformPluginSourceForCDN({
      pluginId: meta.id,
      version,
      source: pluginCode,
    });
    return pluginCode;
  } else {
    //local plugin loading
    const response = await fetch('public/' + meta.module + '.js');
    let pluginCode = await response.text();
    pluginCode = patchPluginSourceMap(meta, pluginCode);
    return pluginCode;
  }
}

function getActivityErrorHandler(pluginId: string) {
  return async function error(proxyError?: Error & { sandboxError?: boolean }) {
    if (!proxyError) {
      return;
    }
    // flag this error as a sandbox error
    proxyError.sandboxError = true;

    //  create a new error to unwrap it from the proxy
    const newError = new Error(proxyError.message.toString());
    newError.name = proxyError.name.toString();
    newError.stack = proxyError.stack || '';

    // If you are seeing this is because
    // the plugin is throwing an error
    // and it is not being caught by the plugin code
    // This is a sandbox wrapper error.
    // and not the real error
    console.log(`[sandbox] Error from plugin ${pluginId}`);
    console.error(newError);
  };
}

/**
 * Patches the plugin's module.js source code references to sourcemaps to include the full url
 * of the module.js file instead of the regular relative reference.
 *
 * Because the plugin module.js code is loaded via fetch and then "eval" as a string
 * it can't find the references to the module.js.map directly and we need to patch it
 * to point to the correct location
 */
function patchPluginSourceMap(meta: PluginMeta, pluginCode: string): string {
  // skips inlined and files without source maps
  if (pluginCode.includes('//# sourceMappingURL=module.js.map')) {
    let replaceWith = '';
    // make sure we don't add the sourceURL twice
    if (!pluginCode.includes('//# sourceURL') || !pluginCode.includes('//@ sourceUrl')) {
      replaceWith += `//# sourceURL=module.js\n`;
    }
    // modify the source map url to point to the correct location
    const sourceCodeMapUrl = `/public/${meta.module}.js.map`;
    replaceWith += `//# sourceMappingURL=${sourceCodeMapUrl}`;

    return pluginCode.replace('//# sourceMappingURL=module.js.map', replaceWith);
  }
  return pluginCode;
}

function resolvePluginDependencies(deps: string[]) {
  // resolve dependencies
  const resolvedDeps: CompartmentDependencyModule[] = [];
  for (const dep of deps) {
    const resolvedDep = sandboxPluginDependencies.get(dep);
    if (!resolvedDep) {
      throw new Error(`[sandbox] Could not resolve dependency ${dep}`);
    }
    resolvedDeps.push(resolvedDep);
  }
  return resolvedDeps;
}
