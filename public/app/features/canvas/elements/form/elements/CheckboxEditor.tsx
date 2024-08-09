import { Field, Input } from '@grafana/ui';
import { ParamsEditor } from 'app/plugins/panel/canvas/editor/element/ParamsEditor';

interface CheckboxEditorProps {
  title: string;
  options: Array<[string, string]>;
  onParamsChange: (v: Array<[string, string]>) => void;
  onTitleChange: (v: string) => void;
}

export const CheckboxEditor = ({ title, options, onParamsChange, onTitleChange }: CheckboxEditorProps) => {
  return (
    <>
      <Field label="Checkbox group title">
        <Input defaultValue={title} onBlur={(e) => onTitleChange(e.currentTarget.value)} />
      </Field>
      <Field label="Parameters">
        <ParamsEditor value={options ?? []} onChange={onParamsChange} />
      </Field>
    </>
  );
};
