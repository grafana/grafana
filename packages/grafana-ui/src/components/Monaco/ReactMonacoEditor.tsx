import MonacoEditor, { loader as monacoEditorLoader, Monaco } from '@monaco-editor/react';
import React, { useCallback } from 'react';

import { useTheme2 } from '../../themes';

import defineThemes from './theme';
import type { ReactMonacoEditorProps } from './types';

monacoEditorLoader.config({
  paths: {
    vs: (window.__grafana_public_path__ ?? 'public/') + 'lib/monaco/min/vs',
  },
});

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
    <MonacoEditor
      {...props}
      theme={theme.isDark ? 'grafana-dark' : 'grafana-light'}
      beforeMount={onMonacoBeforeMount}
    />
  );
};
