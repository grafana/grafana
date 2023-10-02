import createVirtualEnvironment from '@locker/near-membrane-dom';
import { ProxyTarget } from '@locker/near-membrane-shared';

import { BootData, PluginMeta } from '@grafana/data';
import { config, logInfo } from '@grafana/runtime';
import { defaultTrustedTypesPolicy } from 'app/core/trustedTypePolicies';

import { getPluginSettings } from '../pluginSettings';

import { getPluginCode } from './code_loader';
import { getGeneralSandboxDistortionMap, distortLiveApis } from './distortion_map';
import {
  getSafeSandboxDomElement,
  isDomElement,
  isLiveTarget,
  markDomElementStyleAsALiveTarget,
  patchObjectAsLiveTarget,
} from './document_sandbox';
import { sandboxPluginDependencies } from './plugin_dependencies';
import { sandboxPluginComponents } from './sandbox_components';
import { CompartmentDependencyModule, PluginFactoryFunction, SandboxEnvironment } from './types';
import { logError } from './utils';

// Loads near membrane custom formatter for near membrane proxy objects.
if (process.env.NODE_ENV !== 'production') {
  require('@locker/near-membrane-dom/custom-devtools-formatter');
}

const pluginImportCache = new Map<string, Promise<System.Module>>();
const pluginLogCache: Record<string, boolean> = {};

export async function importPluginModuleInSandbox({ pluginId }: { pluginId: string }): Promise<System.Module> {
  try {
    const pluginMeta = await getPluginSettings(pluginId);
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

async function doImportPluginModuleInSandbox(meta: PluginMeta): Promise<System.Module> {
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
      distortLiveApis();
      const distortion = generalDistortionMap.get(originalValue);
      if (distortion) {
        return distortion(originalValue, meta, sandboxEnvironment) as ProxyTarget;
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
        get monaco() {
          // `window.monaco` may be undefined when invoked. However, plugins have long
          // accessed it directly, aware of this possibility.
          return Reflect.get(window, 'monaco');
        },
        get Prism() {
          // Similar to `window.monaco`, `window.Prism` may be undefined when invoked.
          return Reflect.get(window, 'Prism');
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

function resolvePluginDependencies(deps: string[]) {
  // resolve dependencies
  const resolvedDeps: CompartmentDependencyModule[] = [];
  for (const dep of deps) {
    let resolvedDep = sandboxPluginDependencies.get(dep);
    if (resolvedDep?.__useDefault) {
      resolvedDep = resolvedDep.default;
    }

    if (!resolvedDep) {
      throw new Error(`[sandbox] Could not resolve dependency ${dep}`);
    }
    resolvedDeps.push(resolvedDep);
  }
  return resolvedDeps;
}
