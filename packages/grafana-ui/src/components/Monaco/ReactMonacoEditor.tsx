import React from 'react';
import MonacoEditor, { loader as monacoEditorLoader } from '@monaco-editor/react';
import defineThemes from './theme';
import { useTheme2 } from '../../themes';
import { Monaco } from './types';
import type { Props } from './reactMonacoEditorProps';

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

export const ReactMonacoEditor = (props: Props) => {
  const theme = useTheme2();
  initMonaco();
  const { beforeMount, ...rest } = props;

  const handleBeforeMount = (monaco: Monaco) => {
    defineThemes(monaco, theme);

    // call user-speficied `beforeMount` if it exists
    beforeMount?.(monaco);
  };
  const monacoTheme = theme.isDark ? 'grafana-dark' : 'grafana-light';

  return <MonacoEditor theme={monacoTheme} beforeMount={handleBeforeMount} {...rest} />;
};
