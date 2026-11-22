import CodeMirror from '@uiw/react-codemirror';
import { memo } from 'react';

import { type BaseCodeEditorProps } from './types';
import { useCodeMirrorSetup } from './useCodeMirrorSetup';

export const BaseCodeEditor = memo(function BaseCodeEditor(props: BaseCodeEditorProps) {
  const { ref, props: editorProps, languageAlert, copyButton } = useCodeMirrorSetup(props);

  return (
    <>
      {languageAlert}
      <CodeMirror ref={ref} {...editorProps} />
      {copyButton}
    </>
  );
});
