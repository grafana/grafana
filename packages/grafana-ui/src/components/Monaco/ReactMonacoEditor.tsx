import Editor, { loader as monacoEditorLoader, type Monaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useCallback, useEffect } from 'react';

import { useTheme2 } from '../../themes/ThemeContext';

import { isPromqlCoauthorEnabled } from './PromQLCoauthor/isEnabled';
import defineThemes from './theme';
import type { ReactMonacoEditorProps } from './types';

// pass the monaco editor to the loader to bypass requirejs
monacoEditorLoader.config({ monaco });

export const ReactMonacoEditor = (props: ReactMonacoEditorProps) => {
  const { beforeMount, onMount, options, ...restProps } = props;

  const theme = useTheme2();
  const onMonacoBeforeMount = useCallback(
    (monaco: Monaco) => {
      beforeMount?.(monaco);
    },
    [beforeMount]
  );

  useEffect(() => {
    defineThemes(monaco, theme);
  }, [theme]);

  return (
    <Editor
      {...restProps}
      options={{
        ...options,
        fontFamily: theme.typography.code.fontFamily,
      }}
      theme={theme.isDark ? 'grafana-dark' : 'grafana-light'}
      beforeMount={onMonacoBeforeMount}
      onMount={(editor, monaco) => {
        // we use a custom font in our monaco editor
        // we need monaco to remeasure the fonts after they are loaded to prevent alignment issues
        // see https://github.com/microsoft/monaco-editor/issues/648#issuecomment-564978560
        document.fonts.ready.then(() => {
          monaco.editor.remeasureFonts();
        });
        // Prototype-only, branch-scoped: AI PromQL query co-authoring. Gated on
        // the promql language + a localStorage flag so no other editor is affected.
        // Dynamically imported to keep it off the main path.
        if (props.language === 'promql' && isPromqlCoauthorEnabled()) {
          import('./PromQLCoauthor/attachPromQLCoauthor').then(({ attachPromQLCoauthor }) => {
            const coauthor = attachPromQLCoauthor(editor, monaco, theme);
            editor.onDidDispose(() => coauthor.dispose());
          });
        }
        onMount?.(editor, monaco);
      }}
    />
  );
};
