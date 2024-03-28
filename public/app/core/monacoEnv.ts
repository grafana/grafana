import editorWorkerUrl from 'monaco-editor/esm/vs/editor/editor.worker.js?worker&url';
import cssWorkerUrl from 'monaco-editor/esm/vs/language/css/css.worker?worker&url';
import htmlWorkerUrl from 'monaco-editor/esm/vs/language/html/html.worker?worker&url';
import jsonWorkerUrl from 'monaco-editor/esm/vs/language/json/json.worker?worker&url';
import typescriptWorkerUrl from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker&url';

import { monacoLanguageRegistry } from '@grafana/data';

import { WorkaroundWorker } from './utils/CorsWorker';

export function setMonacoEnv() {
  self.MonacoEnvironment = {
    getWorker(_moduleId, label) {
      const language = monacoLanguageRegistry.getIfExists(label);

      if (language) {
        const moduleUrl = language.init();
        return WorkaroundWorker(moduleUrl, { name: label });
      }

      if (label === 'json') {
        return WorkaroundWorker(jsonWorkerUrl, { name: label });
      }

      if (label === 'css' || label === 'scss' || label === 'less') {
        return WorkaroundWorker(cssWorkerUrl, { name: label });
      }

      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return WorkaroundWorker(htmlWorkerUrl, { name: label });
      }

      if (label === 'typescript' || label === 'javascript') {
        return WorkaroundWorker(typescriptWorkerUrl, { name: label });
      }

      return WorkaroundWorker(editorWorkerUrl, { name: label });
    },
  };
}
