// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference types="ses" />
import * as emotion from '@emotion/css';
import * as emotionReact from '@emotion/react';
import createVirtualEnvironment from '@locker/near-membrane-dom';
import * as d3 from 'd3';
import jquery from 'jquery';
import _ from 'lodash'; // eslint-disable-line lodash/import-scope
import moment from 'moment'; // eslint-disable-line no-restricted-imports
import prismjs from 'prismjs';
import react from 'react';
import reactDom from 'react-dom';
import * as reactRedux from 'react-redux'; // eslint-disable-line no-restricted-imports
import * as reactRouter from 'react-router-dom';
import * as redux from 'redux';
import * as rxjs from 'rxjs';
import * as rxjsOperators from 'rxjs/operators';
import slate from 'slate';
import slatePlain from 'slate-plain-serializer';
import slateReact from 'slate-react';

import * as grafanaData from '@grafana/data';
import * as grafanaRuntime from '@grafana/runtime';
import * as grafanaUIraw from '@grafana/ui';

import { getGeneralSandboxDistortionMap } from './sandbox/distortion_map';
import { createSandboxDocument } from './sandbox/document_sandbox';

const prefix = '[sandbox]';

export const compartmentDependencies = {
  '@grafana/data': grafanaData,
  '@grafana/ui': grafanaUIraw,
  '@grafana/runtime': grafanaRuntime,
  lodash: _,
  moment,
  jquery,
  d3,
  rxjs,
  'rxjs/operators': rxjsOperators,
  'react-router-dom': reactRouter,
  // Experimental modules
  prismjs,
  slate,
  'slate-react': slateReact,
  'slate-plain-serializer': slatePlain,
  react,
  'react-dom': reactDom,
  'react-redux': reactRedux,
  redux,
  emotion,
  '@emotion/css': emotion,
  '@emotion/react': emotionReact,
};

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

    console.log('[actually] Importing plugin inside sandbox: ', pluginName, ' from path: ', path, '');
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
