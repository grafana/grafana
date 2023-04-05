// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference types="ses" />
import createVirtualEnvironment from '@locker/near-membrane-dom';
import react from 'react';

import * as grafanaData from '@grafana/data';
import * as grafanaRuntime from '@grafana/runtime';
import * as grafanaUIraw from '@grafana/ui';

const prefix = '[sandbox]';

export function createSandboxDocument(): Document {
  const sandboxDocument = document.implementation.createDocument('http://www.w3.org/1999/xhtml', 'html', null);
  const body = document.createElementNS('http://www.w3.org/1999/xhtml', 'body');
  body.setAttribute('id', 'abc');
  sandboxDocument.documentElement.appendChild(body);
  return sandboxDocument;
}

export function getSandboxedWebApis({ pluginName, isDevMode }: { pluginName: string; isDevMode: boolean }) {
  const sandboxLog = function (...args: unknown[]) {
    console.log(`${prefix} ${pluginName}:`, ...args);
  };

  console.log('isDevMode', isDevMode);
  const sandboxDoc = createSandboxDocument();

  return {
    alert: function (message: string) {
      sandboxLog('alert()', message);
    },
    document: sandboxDoc,
    console: {
      log: sandboxLog,
      warn: sandboxLog,
      error: sandboxLog,
      info: sandboxLog,
      debug: sandboxLog,
    },
    fetch: function (url: string, options: any) {
      sandboxLog('fetch()', url, options);
      return Promise.reject('fetch() is not allowed in plugins');
    },
    window: {},
  };
}

export const compartmentDependencies = {
  '@grafana/data': grafanaData,
  '@grafana/ui': grafanaUIraw,
  '@grafana/runtime': grafanaRuntime,
  react: react,
};

const importSandboxCache = new Map<string, Promise<any>>();

/**
 * Implements a cache to prevent a plugin loading twice in the same session
 * This happens when several parts of grafana tries to load the same plugin
 * For non-sandbox plugins, this is handled by systemjs
 */
export function importPluginInsideSandbox(path: string): Promise<any> {
  if (importSandboxCache.has(path)) {
    return importSandboxCache.get(path)!;
  }
  const promise = doImportPluginInsideSandbox(path);
  importSandboxCache.set(path, promise);
  return promise;
}

export async function doImportPluginInsideSandbox(path: string): Promise<any> {
  let resolved = false;
  return new Promise(async (resolve, reject) => {
    const pluginName = path.split('/')[1];
    console.log('Importing plugin inside sandbox: ', pluginName, ' from path: ', path, '');
    // load plugin code into a string
    const response = await fetch('public/' + path + '.js');
    const pluginCode = await response.text();

    let pluginExports = {};
    // const isDevMode = process.enjv.NODE_ENV === 'development';

    const distortionMap = new Map();

    const env = createVirtualEnvironment(window, {
      distortionCallback(v) {
        return distortionMap.get(v) ?? v;
      },
      endowments: Object.getOwnPropertyDescriptors({
        define(deps: string[], code: () => {}) {
          //@ts-ignore
          const resolvedDeps = deps.map((dep) => compartmentDependencies[dep]);
          // execute the module's code with dependencies to get its export
          //@ts-ignore
          pluginExports = code.apply(null, resolvedDeps);
          if (!resolved) {
            resolved = true;
            resolve(pluginExports);
          }
        },
        ...getSandboxedWebApis({
          pluginName,
          isDevMode: true,
        }),
      }),
    });

    try {
      env.evaluate(pluginCode);
    } catch (e) {
      console.error(`[sandbox] Error loading plugin ${path}`, e);
      reject(e);
    }
  });
}
