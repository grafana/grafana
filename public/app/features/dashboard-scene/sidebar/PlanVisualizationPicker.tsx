import { useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import { type VizTypeChangeDetails } from 'app/features/panel/components/VizTypePicker/types';

import { PanelVizTypePicker } from '../panel-edit/PanelVizTypePicker';
import { getDashboardSceneFor } from '../utils/utils';

/**
 * Use the visualization picker without opening the panel editor, which adds queries.
 * Do not cache options across switches: placeholder options describe the sample data
 * for the current visualization.
 */
export function PlanVisualizationPicker({ panel }: { panel: VizPanel }) {
  const [isPickerOpen, setPickerOpen] = useState(false);

  const onChange = async (options: VizTypeChangeDetails) => {
    await getDashboardSceneFor(panel).changePanelPlugin(panel, options.pluginId, options.options, options.fieldConfig);
    setPickerOpen(false);
  };

  if (isPickerOpen) {
    return (
      <PanelVizTypePicker
        panel={panel}
        data={sceneGraph.getData(panel).state.data}
        onChange={onChange}
        onClose={() => setPickerOpen(false)}
        showBackButton
      />
    );
  }

  return (
    <Button
      onClick={() => setPickerOpen(true)}
      icon="graph-bar"
      variant="secondary"
      fullWidth
      tooltip={t(
        'dashboard.sidebar.viz-panel.options.change-visualization-tooltip',
        'Choose how this planned panel is drawn'
      )}
      data-testid={selectors.components.Sidebar.changePlanVisualizationButton}
    >
      <Trans i18nKey="dashboard.sidebar.viz-panel.change-visualization-button">Change visualization</Trans>
    </Button>
  );
}
