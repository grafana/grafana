import React from 'react';
import MonacoEditor, { loader as monacoEditorLoader, EditorProps as MonacoEditorProps } from '@monaco-editor/react';

let initalized = false;
function initMonaco() {
  if (initalized) {
    return;
  }

  monacoEditorLoader.config({
    paths: {
      vs: (window.__grafana_public_path__ ?? 'public/') + 'lib/monaco/min/vs',
    },
  });
  initalized = true;
}

export const ReactMonacoEditor = (props: MonacoEditorProps) => {
  initMonaco();
  return <MonacoEditor {...props} />;
};
