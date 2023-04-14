import createVirtualEnvironment from '@locker/near-membrane-dom';

import { GrafanaPlugin } from '@grafana/data';
import { config } from '@grafana/runtime';

import { getGeneralSandboxDistortionMap } from './distortion_map';
import {
  createSandboxDocument,
  fabricateMockElement,
  isDomElement,
  isDomElementInsideSandbox,
} from './document_sandbox';
import { getSandboxedWebApis } from './web_apis';

// Keeping this as an alias type for future changes
type CompartmentDependencyModule = unknown;
export const availableCompartmentDependenciesMap = new Map<string, CompartmentDependencyModule>();

const importSandboxCache = new Map<string, Promise<{ plugin: GrafanaPlugin }>>();

/**
 * Implements a cache to prevent a plugin loading twice in the same session
 * This happens when several parts of grafana tries to load the same plugin
 * For non-sandbox plugins, this is handled by systemjs
 */
export function importPluginInsideSandbox(path: string): Promise<{ plugin: GrafanaPlugin }> {
  if (importSandboxCache.has(path)) {
    return importSandboxCache.get(path)!;
  }
  const promise = doImportPluginInsideSandbox(path);
  importSandboxCache.set(path, promise);
  return promise;
}

async function getPluginCode(path: string) {
  const response = await fetch('public/' + path + '.js');
  return await response.text();
}

async function getPluginSourceMap(path: string) {
  const response = await fetch('public/' + path + '.js.map');
  return await response.text();
}

/**
 * Do the actual import of the plugin inside a sandbox
 */
export async function doImportPluginInsideSandbox(path: string): Promise<{ plugin: GrafanaPlugin }> {
  let resolved = false;
  return new Promise(async (resolve, reject) => {
    const pluginId = path.split('/')[1];

    console.log('[sandbox] Importing plugin inside sandbox: ', pluginId, ' from path: ', path, '');

    const sandboxDocument = createSandboxDocument();
    const generalDistortionMap = getGeneralSandboxDistortionMap();
    const pluginDistortionMap = new Map(generalDistortionMap);

    pluginDistortionMap.set(document.body, sandboxDocument.body);
    pluginDistortionMap.set(document, sandboxDocument);

    const env = createVirtualEnvironment(window, {
      // distortions are interceptors to modify the behavior of objects when
      // the code inside the sandbox tries to access them
      distortionCallback(v) {
        // only allow to pass elements that are inside the sandbox
        if (isDomElement(v) && !isDomElementInsideSandbox(v)) {
          return fabricateMockElement(v.nodeName, sandboxDocument);
        }
        // //@ts-ignore
        // if (v.name) {
        //   //@ts-ignore
        //   console.log('distortionCallback', v.name, v);
        // } else {
        //   console.log('distortionCallback', v);
        // }
        return pluginDistortionMap.get(v) ?? v;
      },
      // custom functions we make available to plugins in their window object
      endowments: Object.getOwnPropertyDescriptors({
        define(deps: string[], code: (...args: CompartmentDependencyModule[]) => { plugin: GrafanaPlugin }) {
          const resolvedDeps: CompartmentDependencyModule[] = [];
          for (const dep of deps) {
            const resolvedDep = availableCompartmentDependenciesMap.get(dep);
            if (!resolvedDep) {
              throw new Error(`[sandbox] Could not resolve dependency ${dep} when loading plugin ${path}`);
            }
            resolvedDeps.push(resolvedDep);
          }
          const pluginExports: { plugin: GrafanaPlugin } = code.apply(null, resolvedDeps);

          if (!pluginExports.plugin) {
            throw new Error(`[sandbox] Plugin ${pluginId} did not export a plugin`);
          }

          if (!resolved) {
            resolved = true;
            resolve(pluginExports);
          }
        },
        ...getSandboxedWebApis({
          pluginId: pluginId,
          isDevMode: true,
        }),
        document: sandboxDocument,
      }),
      instrumentation: {
        startActivity() {
          return {
            stop: () => {},
            async error(proxyError?: Error) {
              if (!proxyError) {
                return;
              }
              const newError = new Error(proxyError.message);
              newError.name = proxyError.name;
              if (proxyError.stack) {
                // Parse the error stack trace
                const stackFrames = proxyError.stack.split('\n').map((frame) => frame.trim());

                // remove not useful stack frames
                const filterOut = ['sandbox', 'proxyhandler', 'trap', 'redconnector'];
                const filteredStackFrames = stackFrames.filter((frame) => {
                  return !filterOut.some((filter) => frame.toLowerCase().includes(filter));
                });

                // Join the filtered stack frames back into a string
                const modifiedStack = filteredStackFrames.join('\n');
                newError.stack = modifiedStack;
              }

              // If you are seeing this is because
              // the plugin is throwing an error
              // and it is not being caught by the plugin code
              // This is a sandbox wrapper error.
              // and not the real error
              console.log(`[sandbox] Error from plugin ${pluginId}`);
              console.error(newError);
            },
          };
        },
        log: () => {},
        error: () => {},
      },
    });

    try {
      let pluginCode = await getPluginCode(path);
      const isDevMode = config.buildInfo.env === 'development';
      if (pluginCode.includes('//# sourceMappingURL=module.js.map') && isDevMode) {
        // this is a production build and we are in dev mode
        // we need to load the source map and add it to the plugin code
        try {
          const sourceMap = await getPluginSourceMap(path);
          const sourceMapUrl = `data:application/json;charset=utf-8;base64,${window.btoa(sourceMap)}`;
          pluginCode = pluginCode.replace(
            '//# sourceMappingURL=module.js.map',
            `//# sourceURL=module.js\n//# sourceMappingURL=${sourceMapUrl}`
          );
        } catch (e) {
          console.error(`[sandbox] Error loading source map for plugin ${pluginId}`, e);
        }
      }
      env.evaluate(pluginCode);
    } catch (e) {
      console.error(`[sandbox] Error loading plugin ${pluginId}`, e);
      reject(e);
    }
  });
}

window.addEventListener('error', (e) => {
  // prevent sandbox errors from being logged twice
  // we log these errors property inside the sandbox itself
  if (e.message.includes('Uncaught') && e.error && e.error.stack && e.error.stack.includes('createRedConnector')) {
    e.preventDefault();
  }
});
