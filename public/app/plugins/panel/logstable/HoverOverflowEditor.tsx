import { type StandardEditorProps } from '@grafana/data';
import { Switch } from '@grafana/ui';

export function HoverOverflowEditor({ id, value, onChange }: StandardEditorProps<boolean | undefined>) {
  return <Switch id={id} value={value ?? false} onChange={(event) => onChange(event.currentTarget.checked)} />;
}
