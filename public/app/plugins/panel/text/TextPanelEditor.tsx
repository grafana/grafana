import { css, cx } from '@emotion/css';
import { lazy, Suspense, useMemo } from 'react';

import { GrafanaTheme2, StandardEditorProps } from '@grafana/data';
import {
  // CodeEditor,
  useStyles2,
  // CodeEditorSuggestionItem,
  // variableSuggestionToCodeEditorSuggestion,
} from '@grafana/ui';

// import { CodeEditor2 } from './CodeEditor2';
import { CodeLanguage, Options, TextMode } from './panelcfg.gen';

const CodeEditor2Lazy = lazy(() => import(/* webpackChunkName: "CodeEditor2" */ './CodeEditor2'));

// export const CodeEditor2Lazy = () => (
//   <Suspense fallback={<p>Loading...</p>}>
//     <AvatarComponent />
//   </Suspense>
// )

export const TextPanelEditor = ({ value, onChange, context }: StandardEditorProps<string, {}, Options>) => {
  const language = useMemo(() => context.options?.code?.language ?? CodeLanguage.Markdown, [context]);
  const styles = useStyles2(getStyles);

  // const getSuggestions = (): CodeEditorSuggestionItem[] => {
  //   if (!context.getSuggestions) {
  //     return [];
  //   }
  //   return context.getSuggestions().map((v) => variableSuggestionToCodeEditorSuggestion(v));
  // };

  /* <CodeEditor
      value={value}
      onBlur={onChange}
      onSave={onChange}
      language={language}
      width={width}
      showMiniMap={false}
      showLineNumbers={false}
      height="500px"
      getSuggestions={getSuggestions}
    /> */

  return (
    <Suspense fallback={<p>Loading...</p>}>
      <CodeEditor2Lazy
        key={language}
        className={cx(styles.editorBox)}
        language={language}
        height={500}
        value={value}
        showLineNumbers={false}
        readOnly={false}
        onBlur={onChange}
        onSave={onChange}
      />
    </Suspense>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  editorBox: css({
    label: 'editorBox',
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    margin: theme.spacing(0.5, 0),
    width: '100%',
    backgroundColor: 'rgb(17, 18, 23)',
  }),
});
