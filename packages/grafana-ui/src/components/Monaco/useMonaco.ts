import { useCallback, useRef } from 'react';
import * as monacoEditor from 'monaco-editor';
import * as monaco from 'monaco-editor';

export type CodeEditorChangeHandler = (value: string) => void;

interface UseMonacoOptions {
  commands?: Record<number, monaco.editor.ICommandHandler>;
  eventHandlers?: Record<string, CodeEditorChangeHandler | undefined>;
}

export const useMonaco = ({ commands, eventHandlers }: UseMonacoOptions) => {
  const editorInstance = useRef<monacoEditor.editor.IStandaloneCodeEditor>();

  const getValue = useCallback(() => {
    if (!editorInstance || !editorInstance.current) {
      throw 'CodeEditor not initialised';
    }

    return editorInstance.current.getValue();
  }, [editorInstance]);

  const initializeEditor = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editorInstance.current = editor;

    // Register Monaco commands
    if (commands) {
      Object.keys(commands).forEach(binding => {
        editor.addCommand(parseInt(binding, 10), commands[parseInt(binding, 10)]);
      });
    }

    // Register Monaco event handlers
    if (eventHandlers) {
      if (eventHandlers.onBlur) {
        editorInstance.current.onDidBlurEditorText(() => {
          eventHandlers.onBlur!(getValue());
        });
      }
    }
  };

  return {
    initializeEditor,
    getValue,
  };
};
