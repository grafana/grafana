import { type EditorView, ViewPlugin } from '@codemirror/view';
import { getJSONSchema, jsonSchema, updateSchema } from 'codemirror-json-schema';
import { useMemo } from 'react';

import { CodeMirrorEditor, type CodeMirrorExtension } from '@grafana/ui/unstable';

interface Props {
  schema: Record<string, unknown>;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  readOnly?: boolean;
  onChange: (event: { target: { value: string } }) => void;
}

export default function SchemaEditor({ schema, ...props }: Props) {
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
    return [...jsonSchema(schema), schemaUpdate];
  }, [schema]);

  const value = props.value ?? props.defaultValue ?? '';
  const onChange = (text: string) => props.onChange({ target: { value: text } });

  return (
    <CodeMirrorEditor
      value={value}
      height="300px"
      extensions={extensions}
      readOnly={Boolean(props.disabled || props.readOnly)}
      onChange={onChange}
      onBlur={onChange}
      onSave={onChange}
    />
  );
}
