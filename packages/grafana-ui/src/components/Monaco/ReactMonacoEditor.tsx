import MonacoEditor, { loader as monacoEditorLoader, useMonaco } from '@monaco-editor/react';
import React, { useEffect } from 'react';

import { useTheme2 } from '../../themes';

import defineThemes from './theme';
import type { ReactMonacoEditorProps } from './types';

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
  monacoEditorLoader.init().then((monaco) => {
    // this call makes sure the themes exist.
    // they will not have the correct colors,
    // but we need them to exist since the beginning,
    // because if we start a monaco instance with
    // a theme that does not exist, it will not work well.
    defineThemes(monaco);
  });
}

export const ReactMonacoEditor = (props: ReactMonacoEditorProps) => {
  const theme = useTheme2();
  const monaco = useMonaco();

  useEffect(() => {
    // monaco can be null or undefined at the beginning, because it is loaded in asynchronously
    if (monaco != null) {
      defineThemes(monaco, theme);
    }
  }, [monaco, theme]);

  initMonaco();

  const monacoTheme = theme.isDark ? 'grafana-dark' : 'grafana-light';

  return <MonacoEditor theme={monacoTheme} {...props} />;
};
