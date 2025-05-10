import { monacoLanguageRegistry } from '@grafana/data';
import { CorsWorker as Worker } from 'app/core/utils/CorsWorker';

export function setMonacoEnv() {
  // Do not use window.self here, as it will not work in the worker context
  // eslint-disable-next-line no-restricted-globals
  self.MonacoEnvironment = {
    getWorker(_moduleId, label) {
      const language = monacoLanguageRegistry.getIfExists(label);

      if (language) {
        return language.init();
      }

      if (label === 'json') {
        return new Worker(new URL('monaco-editor/esm/vs/language/json/json.worker', import.meta.url));
      }

      if (label === 'css' || label === 'scss' || label === 'less') {
        return new Worker(new URL('monaco-editor/esm/vs/language/css/css.worker', import.meta.url));
      }

      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return new Worker(new URL('monaco-editor/esm/vs/language/html/html.worker', import.meta.url));
      }

      if (label === 'typescript' || label === 'javascript') {
        return new Worker(new URL('monaco-editor/esm/vs/language/typescript/ts.worker', import.meta.url));
      }

      return new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker', import.meta.url));
    },
  };
}
