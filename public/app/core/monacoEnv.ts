import { monacoLanguageRegistry } from '@grafana/data';
// TODO: vite - handle CORs with webworkers
// import { CorsWorker as Worker } from 'app/core/utils/CorsWorker';

export function setMonacoEnv() {
  self.MonacoEnvironment = {
    getWorker(_moduleId, label) {
      const getWorkerModule = (moduleUrl, label) => {
        return new Worker(self.MonacoEnvironment.getWorkerUrl(moduleUrl), {
          name: label,
          type: 'module',
        });
      };

      const language = monacoLanguageRegistry.getIfExists(label);

      if (language) {
        const moduleUrl = language.init();
        return getWorkerModule(moduleUrl, label);
      }

      if (label === 'json') {
        return getWorkerModule('/monaco-editor/esm/vs/language/json/json.worker?worker', label);
      }

      if (label === 'css' || label === 'scss' || label === 'less') {
        return getWorkerModule('/monaco-editor/esm/vs/language/css/css.worker?worker', label);
      }

      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return getWorkerModule('/monaco-editor/esm/vs/language/html/html.worker?worker', label);
      }

      if (label === 'typescript' || label === 'javascript') {
        return getWorkerModule('/monaco-editor/esm/vs/language/typescript/ts.worker?worker', label);
      }

      return getWorkerModule('/monaco-editor/esm/vs/editor/editor.worker?worker', label);
    },
  };
}
