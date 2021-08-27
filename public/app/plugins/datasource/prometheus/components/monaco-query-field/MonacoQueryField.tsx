import React, { useRef } from 'react';
import { CodeEditor } from '@grafana/ui';
import type { monaco as monacoNS } from './monacoTypes';
import { useLatest } from 'react-use';
import { setupPromQL } from './setupPromQL';
import { Props } from './MonacoQueryFieldProps';

const options: monacoNS.editor.IStandaloneEditorConstructionOptions = {
  lineNumbers: 'off',
  minimap: { enabled: false },
  lineDecorationsWidth: 0,
  wordWrap: 'off',
  overviewRulerLanes: 0,
  overviewRulerBorder: false,
  folding: false,
  scrollBeyondLastLine: false,
  renderLineHighlight: 'none',
};

const MonacoQueryField = (props: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { languageProvider, history, onChange, initialValue } = props;

  const lpRef = useLatest(languageProvider);
  const historyRef = useLatest(history);

  return (
    <div
      // NOTE: we will be setting inline-style-width/height on this element
      ref={containerRef}
    >
      <CodeEditor
        onBlur={onChange}
        monacoOptions={options}
        language="promql"
        value={initialValue}
        onBeforeEditorMount={(monaco) => {
          // we construct a DataProvider object
          const getSeries = (selector: string) => lpRef.current.getSeries(selector);

          const getHistory = () =>
            Promise.resolve(historyRef.current.map((h) => h.query.expr).filter((expr) => expr !== undefined));

          const getAllMetricNames = () => {
            const { metricsMetadata } = lpRef.current;
            const result = metricsMetadata == null ? [] : Object.keys(metricsMetadata);
            return Promise.resolve(result);
          };

          setupPromQL(monaco, { getSeries, getHistory, getAllMetricNames });
        }}
        onEditorDidMount={(editor, monaco) => {
          // this code makes the editor resize itself so that the content fits
          // (it will grow taller when necessary)
          // FIXME: maybe move this functionality into CodeEditor, like:
          // <CodeEditor resizingMode="single-line"/>
          const updateElementHeight = () => {
            const containerDiv = containerRef.current;
            if (containerDiv !== null) {
              const pixelHeight = editor.getContentHeight();
              containerDiv.style.height = `${pixelHeight}px`;
              containerDiv.style.width = '100%';
              const pixelWidth = containerDiv.clientWidth;
              editor.layout({ width: pixelWidth, height: pixelHeight });
            }
          };

          editor.onDidContentSizeChange(updateElementHeight);
          updateElementHeight();

          // handle: shift + enter
          // FIXME: maybe move this functionality into CodeEditor?
          editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
            const text = editor.getValue();
            props.onChange(text);
            props.onRunQuery();
          });
        }}
      />
    </div>
  );
};

// we will lazy-load this module using React.lazy,
// and that only supports default-exports,
// so we have to default-export this, even if
// it is agains the style-guidelines.

export default MonacoQueryField;
