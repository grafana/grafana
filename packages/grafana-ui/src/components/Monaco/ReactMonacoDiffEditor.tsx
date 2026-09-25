import { DiffEditor, loader as monacoEditorLoader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useEffect } from 'react';

import { useTheme2 } from '../../themes/ThemeContext';

import defineThemes from './theme';
import type { ReactMonacoDiffEditorProps } from './types';

// pass the monaco editor to the loader to bypass requirejs
monacoEditorLoader.config({ monaco });

export const ReactMonacoDiffEditor = (props: ReactMonacoDiffEditorProps) => {
  const { options, onMount, ...restProps } = props;

  const theme = useTheme2();

  useEffect(() => {
    defineThemes(monaco, theme);
  }, [theme]);

  return (
    <DiffEditor
      {...restProps}
      options={{
        ...options,
        fontFamily: theme.typography.code.fontFamily,
      }}
      theme={theme.isDark ? 'grafana-dark' : 'grafana-light'}
      onMount={(editor, monaco) => {
        // we use a custom font in our monaco editor
        // we need monaco to remeasure the fonts after they are loaded to prevent alignment issues
        document.fonts.ready.then(() => {
          monaco.editor.remeasureFonts();
        });
        onMount?.(editor, monaco);
      }}
    />
  );
};
