import CodeMirror from '@uiw/react-codemirror';
import { memo } from 'react';

import { type CodeMirrorEditorProps, type CustomCodeEditorProps } from './types';
import { useCodeMirrorSetup } from './useCodeMirrorSetup';

export const CustomCodeEditor = memo(function CustomCodeEditor(props: CustomCodeEditorProps) {
  const { ref, props: editorProps, languageAlert } = useCodeMirrorSetup(props);

  return (
    <>
      {languageAlert}
      <CodeMirror ref={ref} {...editorProps} />
    </>
  );
});

export const CodeEditor = memo(function CodeEditor(props: CodeMirrorEditorProps) {
  return <CustomCodeEditor {...props} />;
});
