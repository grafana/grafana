import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';
import { useCallback, useRef } from 'react';
import * as React from 'react';

import { CodeEditor, Monaco } from '@grafana/ui';

import { CloudWatchDatasource } from '../../../datasource';
import language from '../../../language/metric-math/definition';
import { TRIGGER_SUGGEST } from '../../../language/monarch/commands';
import { registerLanguage } from '../../../language/monarch/register';

export interface Props {
  onChange: (query: string) => void;
  expression: string;
  datasource: CloudWatchDatasource;
}

export function MathExpressionQueryField({ expression: query, onChange, datasource }: React.PropsWithChildren<Props>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onEditorMount = useCallback(
    (editor: monacoType.editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editor.onDidFocusEditorText(() => editor.trigger(TRIGGER_SUGGEST.id, TRIGGER_SUGGEST.id, {}));
      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
        const text = editor.getValue();
        onChange(text);
      });

      // auto resizes the editor to be the height of the content it holds
      // this code comes from the Prometheus query editor.
      // We may wish to consider abstracting it into the grafana/ui repo in the future
      const updateElementHeight = () => {
        const containerDiv = containerRef.current;
        if (containerDiv !== null) {
          const maxPixelHeight = Math.min(200, editor.getContentHeight());
          const pixelHeight = Math.max(32, maxPixelHeight);
          containerDiv.style.height = `${pixelHeight}px`;
          containerDiv.style.width = '100%';
          const pixelWidth = containerDiv.clientWidth;
          editor.layout({ width: pixelWidth, height: pixelHeight });
        }
      };

      editor.onDidContentSizeChange(updateElementHeight);
      updateElementHeight();
    },
    [onChange]
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
          scrollbar: {
            vertical: 'hidden',
            horizontal: 'hidden',
          },
          suggestFontSize: 12,
          wordWrap: 'on',
          padding: {
            top: 6,
          },
        }}
        language={language.id}
        value={query}
        onBlur={(value) => {
          if (value !== query) {
            onChange(value);
          }
        }}
        onBeforeEditorMount={(monaco: Monaco) =>
          registerLanguage(monaco, language, datasource.metricMathCompletionItemProvider)
        }
        onEditorDidMount={onEditorMount}
      />
    </div>
  );
}
