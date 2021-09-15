import React, { useRef } from 'react';
import { CodeEditor, CodeEditorMonacoOptions } from '@grafana/ui';
import { useLatest } from 'react-use';
import { promLanguageDefinition } from 'monaco-promql';
import { getCompletionProvider } from './monaco-completion-provider';
import { Props } from './MonacoQueryFieldProps';

const options: CodeEditorMonacoOptions = {
  lineNumbers: 'off',
  minimap: { enabled: false },
  lineDecorationsWidth: 0,
  wordWrap: 'off',
  overviewRulerLanes: 0,
  overviewRulerBorder: false,
  folding: false,
  scrollBeyondLastLine: false,
  renderLineHighlight: 'none',
  fontSize: 14,
  suggestFontSize: 12,
  // we need `fixedOverflowWidgets` because otherwise in grafana-dashboards
  // the popup is clipped by the panel-visualizations.
  fixedOverflowWidgets: true,
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
      style={{
        // FIXME:
        // this is how the non-monaco query-editor is styled,
        // through the "gf-form" class
        // so to have the same effect, we do the same.
        // this should be applied somehow differently probably,
        // like a min-height on the whole row.
        marginBottom: '4px',
      }}
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
            const result =
              metricsMetadata == null
                ? []
                : Object.entries(metricsMetadata).map(([k, v]) => ({
                    name: k,
                    help: v[0].help,
                    type: v[0].type,
                  }));
            return Promise.resolve(result);
          };

          const dataProvider = { getSeries, getHistory, getAllMetricNames };

          const langId = promLanguageDefinition.id;
          monaco.languages.register(promLanguageDefinition);
          promLanguageDefinition.loader().then((mod) => {
            monaco.languages.setMonarchTokensProvider(langId, mod.language);
            monaco.languages.setLanguageConfiguration(langId, mod.languageConfiguration);
            const completionProvider = getCompletionProvider(monaco, dataProvider);
            monaco.languages.registerCompletionItemProvider(langId, completionProvider);
          });

          // FIXME: should we unregister this at end end?
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
