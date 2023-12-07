import { css } from '@emotion/css';
import React, { useRef, useEffect, useState } from 'react';

import { useStyles2 } from '@grafana/ui';

import {
  basicSetup,
  PRQLEditorView,
  prql,
  EditorState,
  oneDark,
  prqlLanguage,
  CompletionContext,
  syntaxTree,
  readonlySetup,
  sql,
} from '../../../../../../prql/index';

function myCompletions(context: CompletionContext, metricNames: string[]) {
  let word = context.matchBefore(/\w*/);
  if (word?.from === word?.to && !context.explicit) {
    return null;
  }

  let nodeBefore = syntaxTree(context.state).resolveInner(context.pos, -1);
  // let nodeAfter = syntaxTree(context.state).resolveInner(context.pos, 1);
  // console.log('context', context)
  // console.log('nodeBefore', nodeBefore)
  // console.log('nodeAfter', nodeAfter)

  // Top level selector, i.e. "from"
  if (nodeBefore?.type?.name === 'CallExpression' && nodeBefore?.parent?.type?.name === 'Pipeline') {
    //https://codemirror.net/docs/ref/#autocomplete
    return {
      from: word?.from,
      filter: false,
      options: metricNames.map((metric) => ({ label: metric, type: 'constant', boost: 99, section: 'metrics' })),
    };
  }

  return {
    from: word?.from,
    options: [],
  };
}

interface Props {
  metricNames: string[];
  queryString?: string;
  readOnly?: boolean; // transparent bg, make it obviously readonly
  onEditorChange?: (queryString: string) => void;
  mode?: 'prql' | 'sql';
}

const getStyles = (readOnly?: boolean) => {
  if (readOnly) {
    return {
      editor: css`
        .ͼo {
          background-color: rgba(40, 44, 52, 0.3);
          color: rgba(171, 178, 191, 0.9);

          .cm-gutters {
            background-color: rgba(40, 44, 52, 0.3);
            color: rgba(125, 135, 153, 0.4);
          }
          .ͼq {
            color: rgba(224, 108, 117, 0.9);
          }
          .ͼu {
            color: rgba(229, 192, 123, 0.9);
          }
          .ͼr {
            color: rgba(97, 175, 239, 0.9);
          }
          .ͼv {
            color: rgba(86, 182, 194, 0.9);
          }
        }
      `,
    };
  } else {
    return {
      editor: css``,
    };
  }
};

export const PRQLEditor = (props: Props) => {
  const editor = useRef(null);
  const { queryString: doc, metricNames, readOnly, onEditorChange } = props;
  const styles = useStyles2((theme) => getStyles(readOnly));
  const [mode, setMode] = useState(props.mode);

  useEffect(() => {
    //@ts-ignore
    const listener = PRQLEditorView.updateListener.of((update) => {
      if (update.changedRanges.length > 0 && onEditorChange) {
        onEditorChange(update.state.doc.toString());
      }
    });

    const languageExtensions =
      mode === 'sql'
        ? [sql()]
        : [
            prqlLanguage.data.of({
              autocomplete: (context: CompletionContext) => myCompletions(context, metricNames),
            }),
            prql(),
          ];

    const startState = EditorState.create({
      doc: doc,
      extensions: [
        onEditorChange !== undefined ? listener : [],
        readOnly ? readonlySetup : basicSetup,
        oneDark,
        languageExtensions,
        [EditorState.readOnly.of(readOnly ?? false)],
      ],
    });

    const view = new PRQLEditorView({
      state: startState,
      parent: editor.current!,
      extensions: [PRQLEditorView.editable.of(!readOnly ?? true)],
    });

    return () => {
      view.destroy();
    };
    // Need to reorg components, for now don't re-render the editor when the props change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, mode]);

  useEffect(() => {
    const wordsFromFirstLine = doc?.split('\n')[0].split(' ');
    if (wordsFromFirstLine?.length && wordsFromFirstLine[0]?.toLowerCase() === 'select') {
      setMode('sql');
      return;
    }

    if (wordsFromFirstLine?.length && wordsFromFirstLine[0]?.toLowerCase() === 'from') {
      setMode('prql');
      return;
    }
  }, [doc]);

  return (
    <div className={styles.editor} id="editor">
      <div ref={editor}></div>
    </div>
  );
};
