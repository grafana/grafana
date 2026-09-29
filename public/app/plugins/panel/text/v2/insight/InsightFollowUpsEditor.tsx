import { type StandardEditorProps } from '@grafana/data';
import { InsightFollowUpsList } from 'app/features/dashboard-scene/insight-panel/InsightFollowUpsList';

export function InsightFollowUpsEditor({ value, onChange }: StandardEditorProps<string[]>) {
  return <InsightFollowUpsList value={value ?? []} onChange={onChange} />;
}
