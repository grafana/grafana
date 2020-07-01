/* eslint-disable @typescript-eslint/explicit-member-accessibility */
/* eslint-disable @typescript-eslint/interface-name-prefix */

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *
 * Originally COPIED FROM:
 * https://raw.githubusercontent.com/microsoft/monaco-languages/master/src/_.contribution.ts
 *
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

// Allow for running under nodejs/requirejs in tests
const _monaco: typeof monaco = typeof monaco === 'undefined' ? (self as any).monaco : monaco;

interface ILang extends monaco.languages.ILanguageExtensionPoint {
  loader: () => Promise<ILangImpl>;
}

interface ILangImpl {
  conf: monaco.languages.LanguageConfiguration;
  language: monaco.languages.IMonarchLanguage;
}

const languageDefinitions: { [languageId: string]: ILang } = {};
const lazyLanguageLoaders: { [languageId: string]: LazyLanguageLoader } = {};

class LazyLanguageLoader {
  public static getOrCreate(languageId: string): LazyLanguageLoader {
    if (!lazyLanguageLoaders[languageId]) {
      lazyLanguageLoaders[languageId] = new LazyLanguageLoader(languageId);
    }
    return lazyLanguageLoaders[languageId];
  }

  private readonly _languageId: string;
  private _loadingTriggered: boolean;
  private _lazyLoadPromise: Promise<ILangImpl>;
  private _lazyLoadPromiseResolve!: (value: ILangImpl) => void;
  private _lazyLoadPromiseReject!: (err: any) => void;

  constructor(languageId: string) {
    this._languageId = languageId;
    this._loadingTriggered = false;
    this._lazyLoadPromise = new Promise((resolve, reject) => {
      this._lazyLoadPromiseResolve = resolve;
      this._lazyLoadPromiseReject = reject;
    });
  }

  public whenLoaded(): Promise<ILangImpl> {
    return this._lazyLoadPromise;
  }

  public load(): Promise<ILangImpl> {
    if (!this._loadingTriggered) {
      this._loadingTriggered = true;
      languageDefinitions[this._languageId].loader().then(
        mod => this._lazyLoadPromiseResolve(mod),
        err => this._lazyLoadPromiseReject(err)
      );
    }
    return this._lazyLoadPromise;
  }
}

export function loadLanguage(languageId: string): Promise<ILangImpl> {
  return LazyLanguageLoader.getOrCreate(languageId).load();
}

export function registerLanguage(def: ILang): void {
  const languageId = def.id;

  languageDefinitions[languageId] = def;
  _monaco.languages.register(def);

  const lazyLanguageLoader = LazyLanguageLoader.getOrCreate(languageId);
  _monaco.languages.setMonarchTokensProvider(
    languageId,
    lazyLanguageLoader.whenLoaded().then(mod => mod.language)
  );
  _monaco.languages.onLanguage(languageId, () => {
    lazyLanguageLoader.load().then(mod => {
      _monaco.languages.setLanguageConfiguration(languageId, mod.conf);
    });
  });
}
