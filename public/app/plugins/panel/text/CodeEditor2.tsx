import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { css } from '@codemirror/lang-css';
import { go } from '@codemirror/lang-go';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { less } from '@codemirror/lang-less';
import { markdown } from '@codemirror/lang-markdown';
import { sass } from '@codemirror/lang-sass';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import { lintKeymap } from '@codemirror/lint';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { EditorState, Extension } from '@codemirror/state';
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view';
import { useLayoutEffect, useRef } from 'react';

import { CodeLanguage } from './panelcfg.gen';

interface Props {
  className?: string;
  language?: CodeLanguage;
  width?: number | string;
  height?: number | string;
  value?: string;
  showLineNumbers?: boolean;
  readOnly?: boolean;
  onBlur?: (value: string) => void;
  onSave?: (value: string) => void;
}

export const CodeEditor2 = ({
  className,
  language = CodeLanguage.Markdown,
  width = '100%',
  height,
  value = '',
  showLineNumbers = false,
  readOnly = false,
  onBlur,
  onSave,
}: Props) => {
  const domRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const lang =
      language === CodeLanguage.Markdown
        ? markdown()
        : language === CodeLanguage.Typescript
          ? javascript()
          : language === CodeLanguage.Json
            ? json()
            : language === CodeLanguage.Go
              ? go()
              : language === CodeLanguage.Yaml
                ? yaml()
                : language === CodeLanguage.Sql
                  ? sql()
                  : language === CodeLanguage.Xml
                    ? xml()
                    : language === CodeLanguage.Html
                      ? html()
                      : language === CodeLanguage.Css
                        ? css()
                        : language === CodeLanguage.Sass
                          ? sass()
                          : language === CodeLanguage.Less
                            ? less()
                            : null;

    const extensions: Extension[] = [
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      EditorView.lineWrapping,
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),
      crosshairCursor(),
      // highlightActiveLine(),
      highlightSelectionMatches(),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        ...lintKeymap,
      ]),

      EditorView.updateListener.of((e) => {
        if (e.docChanged) {
          // const entry = cmInstances[filename];
          // if (entry.debounce) {
          //   clearTimeout(entry.debounce);
          // }
          // entry.debounce = setTimeout(() => syncContent(filename), 1000);

          let content = ed.state.doc.toString();
          onBlur?.(content);
        }
      }),
    ];

    if (showLineNumbers) {
      extensions.unshift(lineNumbers());
    }

    if (lang != null) {
      extensions.push(lang);
    }

    let ed = new EditorView({
      parent: domRef.current!,
      state: EditorState.create({
        doc: value,
        extensions,
      }),
    });

    return () => ed.destroy();
  }, []);

  return <div className={className} style={{ width, height }} ref={domRef}></div>;
};

export default CodeEditor2;
