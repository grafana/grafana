import { css, cx } from '@emotion/css';
import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';
import { useCallback, useRef } from 'react';

import { CodeEditor, getInputStyles, Monaco, useTheme2 } from '@grafana/ui';

import { DynamicLabelsCompletionItemProvider } from '../../../language/dynamic-labels/CompletionItemProvider';
import language from '../../../language/dynamic-labels/definition';
import { TRIGGER_SUGGEST } from '../../../language/monarch/commands';
import { registerLanguage } from '../../../language/monarch/register';

const dynamicLabelsCompletionItemProvider = new DynamicLabelsCompletionItemProvider();

export interface Props {
  onChange: (query: string) => void;
  label: string;
  width: number;
}

export function DynamicLabelsField({ label, width, onChange }: Props) {
  const theme = useTheme2();
  const styles = getInputStyles({ theme, width });
  const containerRef = useRef<HTMLDivElement>(null);
  const onEditorMount = useCallback(
    (editor: monacoType.editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editor.onDidFocusEditorText(() => editor.trigger(TRIGGER_SUGGEST.id, TRIGGER_SUGGEST.id, {}));
      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
        const text = editor.getValue();
        onChange(text);
      });

      const containerDiv = containerRef.current;
      containerDiv !== null && editor.layout({ width: containerDiv.clientWidth, height: containerDiv.clientHeight });
    },
    [onChange]
  );

  return (
    <div ref={containerRef} className={cx(styles.wrapper)}>
      <CodeEditor
        containerStyles={css({
          border: `1px solid ${theme.colors.action.disabledBackground}`,
          '&:hover': {
            borderColor: theme.components.input.borderColor,
          },
        })}
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
