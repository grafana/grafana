import React, { useRef, useEffect } from 'react';

import {
  basicSetup,
  PRQLEditorView,
  prql,
  EditorState,
  oneDark,
  prqlLanguage,
  CompletionContext,
  syntaxTree,
} from '../../../../../../prql';

function myCompletions(context: CompletionContext, metricNames: string[]) {
  let word = context.matchBefore(/\w*/);
  if (word?.from === word?.to && !context.explicit) {
    return null;
  }

  let nodeBefore = syntaxTree(context.state).resolveInner(context.pos, -1);
  console.log('context', context);
  console.log('nodeBefore', nodeBefore);
  // Top level selector, i.e. "from"
  if (nodeBefore?.type?.name === 'CallExpression' && nodeBefore?.parent?.type?.name === 'Pipeline') {
    //https://codemirror.net/docs/ref/#autocomplete
    return {
      from: word?.from,
      filter: false,
      options: metricNames.map((metric) => ({ label: metric, type: 'constant', boost: 99 })),
    };
  }

  return {
    from: word?.from,
    options: [
      { label: 'match', type: 'keyword' },
      { label: 'hello', type: 'variable', info: '(World)' },
      { label: 'magic', type: 'text', apply: '⠁⭒*.✩.*⭒⠁', detail: 'macro' },
    ],
  };
}

interface Props {
  metricNames: string[];
  queryString: string;

  //@todo
  readOnly?: boolean;
}

export const PRQLEditor = (props: Props) => {
  const editor = useRef(null);
  const { queryString: doc, metricNames } = props;

  // How to make readonly
  useEffect(() => {
    const startState = EditorState.create({
      doc: doc,
      extensions: [
        basicSetup,
        oneDark,
        [
          prqlLanguage.data.of({
            autocomplete: (context: CompletionContext) => myCompletions(context, metricNames),
          }),
          prql(),
        ],
      ],
    });

    const view = new PRQLEditorView({
      state: startState,
      parent: editor.current!,
    });

    return () => {
      view.destroy();
    };
  }, [doc, metricNames]);

  return (
    <div id="editor">
      <div ref={editor}></div>;
    </div>
  );
};
