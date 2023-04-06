// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference types="ses" />
import createVirtualEnvironment from '@locker/near-membrane-dom';
import react from 'react';

import * as grafanaData from '@grafana/data';
import * as grafanaRuntime from '@grafana/runtime';
import * as grafanaUIraw from '@grafana/ui';

import { getGeneralSandboxDistortionMap } from './sandbox/distortion_map';
import { createSandboxDocument } from './sandbox/document_sandbox';

const prefix = '[sandbox]';

export function getSandboxedWebApis({ pluginName, isDevMode }: { pluginName: string; isDevMode: boolean }) {
  const sandboxLog = function (...args: unknown[]) {
    console.log(`${prefix} ${pluginName}:`, ...args);
  };

  return {
    alert: function (message: string) {
      sandboxLog('alert()', message);
    },
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

async function getPluginCode(path: string) {
  const response = await fetch('public/' + path + '.js');
  return await response.text();
}

export async function doImportPluginInsideSandbox(path: string): Promise<any> {
  let resolved = false;
  return new Promise(async (resolve, reject) => {
    const pluginName = path.split('/')[1];

    console.log('Importing plugin inside sandbox: ', pluginName, ' from path: ', path, '');
    const pluginCode = await getPluginCode(path);

    let pluginExports = {};

    const sandboxDocument = createSandboxDocument();
    const generalDistortionMap = getGeneralSandboxDistortionMap();
    const distortionMap = new Map(generalDistortionMap);

    distortionMap.set(document.body, sandboxDocument.body);
    distortionMap.set(document, sandboxDocument);

    const env = createVirtualEnvironment(window, {
      distortionCallback(v) {
        //@ts-ignore
        // if (v.name) {
        //   //@ts-ignore
        //   console.log('distortionCallback', v.name, v);
        // } else {
        //   console.log('distortionCallback', v);
        // }
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
        document: sandboxDocument,
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
