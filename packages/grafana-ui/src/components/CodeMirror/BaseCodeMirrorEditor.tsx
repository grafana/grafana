import CodeMirror from '@uiw/react-codemirror';
import { memo } from 'react';

import { type BaseCodeMirrorEditorProps } from './types';
import { useCodeMirrorSetup } from './useCodeMirrorSetup';

export const BaseCodeMirrorEditor = memo(function BaseCodeMirrorEditor(props: BaseCodeMirrorEditorProps) {
  const { ref, props: editorProps, languageAlert } = useCodeMirrorSetup(props);

  return (
    <>
      {languageAlert}
      <CodeMirror ref={ref} {...editorProps} />
    </>
  );
});
