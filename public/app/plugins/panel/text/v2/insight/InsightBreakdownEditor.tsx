import { type StandardEditorProps } from '@grafana/data';
import { InsightBreakdownPicker } from 'app/features/dashboard-scene/sidebar/insights/InsightBreakdownPicker';

import { usePanelDashboard } from './usePanelDashboard';

export function InsightBreakdownEditor({ value, onChange, id }: StandardEditorProps<string | undefined>) {
  const dashboard = usePanelDashboard();
  return <InsightBreakdownPicker id={id} dashboard={dashboard} value={value} onChange={onChange} />;
}
