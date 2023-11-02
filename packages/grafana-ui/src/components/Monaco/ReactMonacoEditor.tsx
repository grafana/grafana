import Editor, { loader as monacoEditorLoader, Monaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import React, { useCallback } from 'react';

import { useTheme2 } from '../../themes';

import defineThemes from './theme';
import type { ReactMonacoEditorProps } from './types';

monacoEditorLoader.config({ monaco });

self.MonacoEnvironment = {
  getWorker(_moduleId, label) {
    if (label === 'json') {
      return new Worker(
        /* webpackChunkName: "json-worker" */ new URL('monaco-editor/esm/vs/language/json/json.worker', import.meta.url)
      );
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new Worker(
        /* webpackChunkName: "css-worker" */ new URL('monaco-editor/esm/vs/language/css/css.worker', import.meta.url)
      );
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new Worker(
        /* webpackChunkName: "html-worker" */ new URL('monaco-editor/esm/vs/language/html/html.worker', import.meta.url)
      );
    }
    if (label === 'typescript' || label === 'javascript') {
      return new Worker(
        /* webpackChunkName: "typescript-worker" */ new URL(
          'monaco-editor/esm/vs/language/typescript/ts.worker',
          import.meta.url
        )
      );
    }

    return new Worker(
      /* webpackChunkName: "editor-worker" */ new URL('monaco-editor/esm/vs/editor/editor.worker', import.meta.url)
    );
  },
};

export const ReactMonacoEditor = (props: ReactMonacoEditorProps) => {
  const { beforeMount } = props;

  const theme = useTheme2();
  const onMonacoBeforeMount = useCallback(
    (monaco: Monaco) => {
      defineThemes(monaco, theme);
      beforeMount?.(monaco);
    },
    [beforeMount, theme]
  );

  return (
    <Editor {...props} theme={theme.isDark ? 'grafana-dark' : 'grafana-light'} beforeMount={onMonacoBeforeMount} />
  );
};
