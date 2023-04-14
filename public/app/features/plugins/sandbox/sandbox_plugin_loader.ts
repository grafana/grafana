import createVirtualEnvironment from '@locker/near-membrane-dom';

import { GrafanaPlugin } from '@grafana/data';

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
            async error(proxyError?: Error & { sandboxError?: boolean }) {
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
            },
          };
        },
        log: () => {},
        error: () => {},
      },
    });

    try {
      let pluginCode = await getPluginCode(path);
      if (pluginCode.includes('//# sourceMappingURL=module.js.map')) {
        let replaceWith = '';
        // make sure we don't add the sourceURL twice
        if (!pluginCode.includes('//# sourceURL') || !pluginCode.includes('//@ sourceUrl')) {
          replaceWith += `//# sourceURL=module.js\n`;
        }
        // modify the source map url to point to the correct location
        const sourceCodeMapUrl = `/public/${path}.js.map`;
        replaceWith += `//# sourceURL=module.js\n//# sourceMappingURL=${sourceCodeMapUrl}`;

        pluginCode = pluginCode.replace('//# sourceMappingURL=module.js.map', replaceWith);
      }
      env.evaluate(pluginCode);
    } catch (e) {
      console.error(`[sandbox] Error loading plugin ${pluginId}`, e);
      reject(e);
    }
  });
}

window.addEventListener('error', (e: ErrorEvent) => {
  // prevent sandbox errors from being logged twice
  // we log these errors property inside the sandbox itself
  if (e.error?.sandboxError) {
    e.preventDefault();
  }
});
