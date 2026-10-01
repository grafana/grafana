import { type EditorView, ViewPlugin } from '@codemirror/view';
import { getJSONSchema, jsonSchema, updateSchema } from 'codemirror-json-schema';
import { useCallback, useContext, useMemo, useRef, useState } from 'react';

import { CodeMirrorEditor, type CodeMirrorExtension } from '@grafana/ui/unstable';

import { NamespaceContext } from './contexts';
import { schemaAnnotations } from './schemaAnnotations';

interface Props {
  schema: Record<string, unknown>;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  readOnly?: boolean;
  onChange: (event: { target: { value: string } }) => void;
}

export default function SchemaEditor({ schema, ...props }: Props) {
  const namespace = useContext(NamespaceContext);
  const incomingValue = props.value ?? props.defaultValue ?? '';
  const [previousValue, setPreviousValue] = useState(incomingValue);
  const [draft, setDraft] = useState(incomingValue);

  // Swagger may rerender with the same stale value while the user is typing.
  // Only a new incoming value should replace the in-progress draft.
  if (incomingValue !== previousValue) {
    setPreviousValue(incomingValue);
    setDraft(incomingValue);
  }
  const { onChange } = props;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const flush = useCallback((text: string) => onChangeRef.current({ target: { value: text } }), []);
  const annotations = useMemo(() => schemaAnnotations(namespace, flush), [namespace, flush]);

  const extensions = useMemo<CodeMirrorExtension[]>(() => {
    // Reconfiguration retains state fields, so update the schema in this editor's view.
    const schemaUpdate = ViewPlugin.fromClass(
      class {
        private active = true;

        constructor(view: EditorView) {
          queueMicrotask(() => {
            if (this.active && getJSONSchema(view.state) !== schema) {
              updateSchema(view, schema);
            }
          });
        }

        destroy() {
          this.active = false;
        }
      }
    );
    return [...jsonSchema(schema), schemaUpdate, annotations];
  }, [schema, annotations]);

  return (
    <CodeMirrorEditor
      value={draft}
      height="300px"
      extensions={extensions}
      readOnly={Boolean(props.disabled || props.readOnly)}
      onChange={setDraft}
      onBlur={flush}
      onSave={flush}
    />
  );
}
