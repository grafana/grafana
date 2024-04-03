import Editor, { loader as monacoEditorLoader, Monaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import React, { useCallback } from 'react';

import { useTheme2 } from '../../themes';

import defineThemes from './theme';
import type { ReactMonacoEditorProps } from './types';

// pass the monaco editor to the loader to bypass requirejs
monacoEditorLoader.config({ monaco });

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
