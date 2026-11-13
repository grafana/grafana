import CodeMirror from '@uiw/react-codemirror';
import { memo } from 'react';

import { type CodeMirrorEditorProps } from './types';
import { useCodeMirrorSetup } from './useCodeMirrorSetup';

export const CodeEditor = memo(function CodeEditor(props: CodeMirrorEditorProps) {
  const { ref, props: editorProps, languageAlert } = useCodeMirrorSetup(props);

  return (
    <>
      {languageAlert}
      <CodeMirror ref={ref} {...editorProps} />
    </>
  );
});
