import { monacoTypes } from '@grafana/ui';

// this thing here is a workaround in a way.
// what we want to achieve, is that when the autocomplete-window
// opens, the "second, extra popup" with the extra help,
// also opens automatically.
// but there is no API to achieve it.
// the way to do it is to implement the `storageService`
// interface, and provide our custom implementation,
// which will default to `true` for the correct string-key.
// unfortunately, while the typescript-interface exists,
// it is not exported from monaco-editor,
// so we cannot rely on typescript to make sure
// we do it right. all we can do is to manually
// lookup the interface, and make sure we code our code right.
// our code is a "best effort" approach,
// i am not 100% how the `scope` and `target` things work,
// but so far it seems to work ok.
// i would use an another approach, if there was one available.

function makeStorageService() {
  // we need to return an object that fulfills this interface:
  // https://github.com/microsoft/vscode/blob/ff1e16eebb93af79fd6d7af1356c4003a120c563/src/vs/platform/storage/common/storage.ts#L37
  // unfortunately it is not export from monaco-editor

  const strings = new Map<string, string>();

  // we want this to be true by default
  strings.set('expandSuggestionDocs', true.toString());

  return {
    // we do not implement the on* handlers
    onDidChangeValue: (data: unknown): void => undefined,
    onDidChangeTarget: (data: unknown): void => undefined,
    onWillSaveState: (data: unknown): void => undefined,

    get: (key: string, scope: unknown, fallbackValue?: string): string | undefined => {
      return strings.get(key) ?? fallbackValue;
    },

    getBoolean: (key: string, scope: unknown, fallbackValue?: boolean): boolean | undefined => {
      const val = strings.get(key);
      if (val !== undefined) {
        // the interface-docs say the value will be converted
        // to a boolean but do not specify how, so we improvise
        return val === 'true';
      } else {
        return fallbackValue;
      }
    },

    getNumber: (key: string, scope: unknown, fallbackValue?: number): number | undefined => {
      const val = strings.get(key);
      if (val !== undefined) {
        return parseInt(val, 10);
      } else {
        return fallbackValue;
      }
    },

    store: (
      key: string,
      value: string | boolean | number | undefined | null,
      scope: unknown,
      target: unknown
    ): void => {
      // the interface-docs say if the value is nullish, it should act as delete
      if (value === null || value === undefined) {
        strings.delete(key);
      } else {
        strings.set(key, value.toString());
      }
    },

    remove: (key: string, scope: unknown): void => {
      strings.delete(key);
    },

    keys: (scope: unknown, target: unknown): string[] => {
      return Array.from(strings.keys());
    },

    logStorage: (): void => {
      console.log('logStorage: not implemented');
    },

    migrate: (): Promise<void> => {
      // we do not implement this
      return Promise.resolve(undefined);
    },

    isNew: (scope: unknown): boolean => {
      // we create a new storage for every session, we do not persist it,
      // so we return `true`.
      return true;
    },

    flush: (reason?: unknown): Promise<void> => {
      // we do not implement this
      return Promise.resolve(undefined);
    },
  };
}

let overrideServices: monacoTypes.editor.IEditorOverrideServices | null = null;

export function getOverrideServices(): monacoTypes.editor.IEditorOverrideServices {
  // only have one instance of this for every query editor
  if (overrideServices === null) {
    overrideServices = {
      storageService: makeStorageService(),
    };
  }

  return overrideServices;
}
