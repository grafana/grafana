import { Field } from '@grafana/ui';
import { ParamsEditor } from 'app/plugins/panel/canvas/editor/element/ParamsEditor';

interface SelectionEditorProps {
  options: Array<[string, string]>;
  onChange: (v: Array<[string, string]>) => void;
}

export const SelectionEditor = ({ options, onChange }: SelectionEditorProps) => {
  return (
    <Field label="Selection parameters">
      <ParamsEditor value={options ?? []} onChange={onChange} />
    </Field>
  );
};
