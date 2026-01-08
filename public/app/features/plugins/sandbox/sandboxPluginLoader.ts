import createVirtualEnvironment from '@locker/near-membrane-dom';
import { ProxyTarget } from '@locker/near-membrane-shared';

import { BootData } from '@grafana/data';
import { config } from '@grafana/runtime';
import { defaultTrustedTypesPolicy } from 'app/core/trustedTypePolicies';

import { getPluginCode, getPluginLoadData, patchSandboxEnvironmentPrototype } from './codeLoader';
import { getGeneralSandboxDistortionMap, distortLiveApis } from './distortions';
import {
  getSafeSandboxDomElement,
  isDomElement,
  isLiveTarget,
  markDomElementStyleAsALiveTarget,
  patchObjectAsLiveTarget,
  patchWebAPIs,
} from './documentSandbox';
import { sandboxPluginDependencies } from './pluginDependencies';
import { sandboxPluginComponents } from './sandboxComponents';
import { CompartmentDependencyModule, PluginFactoryFunction, SandboxEnvironment, SandboxPluginMeta } from './types';
import { logError, logInfo } from './utils';

// Loads near membrane custom formatter for near membrane proxy objects.
if (process.env.NODE_ENV !== 'production') {
  require('@locker/near-membrane-dom/custom-devtools-formatter');
}

const pluginImportCache = new Map<string, Promise<System.Module>>();
const pluginLogCache: Record<string, boolean> = {};

export async function importPluginModuleInSandbox({ pluginId }: { pluginId: string }): Promise<System.Module> {
  patchWebAPIs();
  try {
    const pluginMeta = getPluginLoadData(pluginId);
    if (!pluginImportCache.has(pluginId)) {
      pluginImportCache.set(pluginId, doImportPluginModuleInSandbox(pluginMeta));
    }
    return pluginImportCache.get(pluginId)!;
  } catch (e) {
    const error = new Error(`Could not import plugin ${pluginId} inside sandbox: ` + e);
    logError(error, {
      pluginId,
      error: String(e),
    });
    throw error;
  }
}

async function doImportPluginModuleInSandbox(meta: SandboxPluginMeta): Promise<System.Module> {
  logInfo('Loading with sandbox', {
    pluginId: meta.id,
  });
  return new Promise(async (resolve, reject) => {
    const generalDistortionMap = getGeneralSandboxDistortionMap();
    let sandboxEnvironment: SandboxEnvironment;
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

      // static distortions are faster distortions with direct object descriptors checks
      const staticDistortion = generalDistortionMap.get(originalValue);
      if (staticDistortion) {
        return staticDistortion(originalValue, meta, sandboxEnvironment) as ProxyTarget;
      }

      // live distortions are slower and have to do runtime checks
      const liveDistortion = distortLiveApis(originalValue);
      if (liveDistortion) {
        return liveDistortion;
      }
      return originalValue;
    }

    // each plugin has its own sandbox
    sandboxEnvironment = createVirtualEnvironment(window, {
      // distortions are interceptors to modify the behavior of objects when
      // the code inside the sandbox tries to access them
      distortionCallback,
      defaultPolicy: defaultTrustedTypesPolicy,
      liveTargetCallback: isLiveTarget,
      // endowments are custom variables we make available to plugins in their window object
      endowments: Object.getOwnPropertyDescriptors({
        // window.location is unforgeable, we make the location available via endowments
        // when the plugin code is loaded, the sandbox replaces the window.location with
        // window.locationSandbox. In the future `window.location` could be a proxy if we
        // want to intercept calls to it.
        locationSandbox: window.location,
        setImmediate: function (fn: Function, ...args: unknown[]) {
          return setTimeout(fn, 0, ...args);
        },
        get monaco() {
          // `window.monaco` may be undefined when invoked. However, plugins have long
          // accessed it directly, aware of this possibility.
          return Reflect.get(window, 'monaco');
        },
        get Prism() {
          // Similar to `window.monaco`, `window.Prism` may be undefined when invoked.
          return Reflect.get(window, 'Prism');
        },
        get jQuery() {
          return Reflect.get(window, 'jQuery');
        },
        get $() {
          return Reflect.get(window, 'jQuery');
        },
        get grafanaBootData(): BootData {
          if (!pluginLogCache[meta.id + '-grafanaBootData']) {
            pluginLogCache[meta.id + '-grafanaBootData'] = true;
            logInfo('Plugin using window.grafanaBootData', {
              sandbox: 'true',
              pluginId: meta.id,
              guessedPluginName: meta.id,
              parent: 'window',
              packageName: 'window',
              key: 'grafanaBootData',
            });
          }

          // We don't want to encourage plugins to use `window.grafanaBootData`. They should
          // use `@grafana/runtime.config` instead.
          // if we are in dev mode we fail this access
          if (config.buildInfo.env === 'development') {
            throw new Error(
              `Error in ${meta.id}: Plugins should not use window.grafanaBootData. Use "config" from "@grafana/runtime" instead.`
            );
          } else {
            console.error(
              `${meta.id.toUpperCase()}: Plugins should not use window.grafanaBootData. Use "config" from "@grafana/runtime" instead.`
            );
          }
          return config.bootData;
        },

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
            const resolvedDeps = await resolvePluginDependencies(dependencies, meta);
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
    });

    patchSandboxEnvironmentPrototype(sandboxEnvironment);

    // fetch plugin's code
    let pluginCode = '';
    try {
      pluginCode = await getPluginCode(meta);
    } catch (e) {
      const error = new Error(`Could not load plugin code ${meta.id}: ` + e);
      logError(error, {
        pluginId: meta.id,
        error: String(e),
      });
      reject(error);
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

/**
 *
 * This function resolves the dependencies using the array of AMD deps.
 * Additionally it supports the RequireJS magic modules `module` and `exports`.
 * https://github.com/requirejs/requirejs/wiki/Differences-between-the-simplified-CommonJS-wrapper-and-standard-AMD-define#magic
 *
 */
async function resolvePluginDependencies(deps: string[], pluginMeta: SandboxPluginMeta) {
  const pluginExports = {};
  const pluginModuleDep: ModuleMeta = {
    id: pluginMeta.id,
    uri: pluginMeta.module,
    exports: pluginExports,
  };

  // resolve dependencies
  const resolvedDeps: CompartmentDependencyModule[] = [];
  for (const dep of deps) {
    let resolvedDep = sandboxPluginDependencies.get(dep);

    if (typeof resolvedDep === 'function') {
      resolvedDep = await resolvedDep();
    }
    if (resolvedDep?.__useDefault) {
      resolvedDep = resolvedDep.default;
    }

    if (dep === 'module') {
      resolvedDep = pluginModuleDep;
    }

    if (dep === 'exports') {
      resolvedDep = pluginExports;
    }

    if (!resolvedDep) {
      const error = new Error(`[sandbox] Could not resolve dependency ${dep}`);
      logError(error, {
        pluginId: pluginMeta.id,
        dependency: dep,
        error: String(error),
      });
      throw error;
    }
    resolvedDeps.push(resolvedDep);
  }
  return resolvedDeps;
}

interface ModuleMeta {
  id: string;
  uri: string;
  exports: System.Module;
}
