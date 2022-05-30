import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';
import React, { useCallback, useRef } from 'react';

import { CodeEditor, Monaco } from '@grafana/ui';

import { DynamicLabelsCompletionItemProvider } from '../dynamic-labels/completion/CompletionItemProvider';
import language from '../dynamic-labels/definition';
import { TRIGGER_SUGGEST } from '../monarch/commands';
import { registerLanguage } from '../monarch/register';

const dynamicLabelsCompletionItemProvider = new DynamicLabelsCompletionItemProvider();

export interface Props {
  onChange: (query: string) => void;
  onRunQuery: () => void;
  label: string;
}

export function DynamicLabelsField({ label, onChange, onRunQuery }: React.PropsWithChildren<Props>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onEditorMount = useCallback(
    (editor: monacoType.editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editor.onDidFocusEditorText(() => editor.trigger(TRIGGER_SUGGEST.id, TRIGGER_SUGGEST.id, {}));
      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
        const text = editor.getValue();
        onChange(text);
        onRunQuery();
      });

      const containerDiv = containerRef.current;
      if (containerDiv !== null) {
        containerDiv.style.height = '32px';
        const pixelWidth = 440;
        containerDiv.style.width = `${pixelWidth}px`;
        editor.layout({ width: pixelWidth, height: 32 });
      }
    },
    [onChange, onRunQuery]
  );

  return (
    <div ref={containerRef}>
      <CodeEditor
        monacoOptions={{
          // without this setting, the auto-resize functionality causes an infinite loop, don't remove it!
          scrollBeyondLastLine: false,

          // These additional options are style focused and are a subset of those in the query editor in Prometheus
          fontSize: 14,
          lineNumbers: 'off',
          renderLineHighlight: 'none',
          overviewRulerLanes: 0,
          scrollbar: {
            vertical: 'hidden',
            horizontal: 'hidden',
          },
          suggestFontSize: 12,
          padding: {
            top: 6,
          },
        }}
        language={language.id}
        value={label}
        onBlur={(value) => {
          if (value !== label) {
            onChange(value);
            onRunQuery();
          }
        }}
        onBeforeEditorMount={(monaco: Monaco) =>
          registerLanguage(monaco, language, dynamicLabelsCompletionItemProvider)
        }
        onEditorDidMount={onEditorMount}
      />
    </div>
  );
}
