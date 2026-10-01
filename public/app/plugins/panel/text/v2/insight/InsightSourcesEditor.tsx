import { useMemo } from 'react';

import { type StandardEditorProps } from '@grafana/data';
import { InsightSourcePicker } from 'app/features/dashboard-scene/sidebar/insights/InsightSourcePicker';
import { getInsightSourcePanels } from 'app/features/dashboard-scene/sidebar/insights/sources';

import { usePanelDashboard } from './usePanelDashboard';

export function InsightSourcesEditor({ value, onChange }: StandardEditorProps<string[]>) {
  const dashboard = usePanelDashboard();
  // Recomputed per render of the options pane: panels can be added while it is open, and
  // usePanelDashboard re-renders on scene state changes.
  const sources = useMemo(() => (dashboard ? getInsightSourcePanels(dashboard) : []), [dashboard]);

  return <InsightSourcePicker sources={sources} value={value ?? []} onChange={onChange} />;
}
