import { useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import { type VizTypeChangeDetails } from 'app/features/panel/components/VizTypePicker/types';

import { PanelVizTypePicker } from '../panel-edit/PanelVizTypePicker';
import { getDashboardSceneFor } from '../utils/utils';

/**
 * Change a planned panel's visualization without entering panel edit.
 *
 * The picker itself is the one the panel editor uses; only its host is new. A plan preview refuses
 * panel edit — it would give the placeholder a live query — so without this the one thing a plan is
 * most likely to need changing would have nowhere to be changed from.
 *
 * Unlike the editor's version this does not cache options across plugin switches: a placeholder's
 * options belong to the sample being drawn, not to anything the user authored, so there is nothing
 * worth restoring if they switch back.
 */
export function PlanVisualizationPicker({ panel }: { panel: VizPanel }) {
  const [isPickerOpen, setPickerOpen] = useState(false);
  const dashboard = getDashboardSceneFor(panel);

  const onChange = (options: VizTypeChangeDetails) => {
    panel.changePluginType(options.pluginId);

    if (options.options) {
      panel.onOptionsChange(options.options, true);
    }
    if (options.fieldConfig) {
      panel.onFieldConfigChange(options.fieldConfig, true);
    }

    // The sample behind the panel was shaped for the old visualization; whoever supplied it decides
    // what the new one should show.
    dashboard.state.planning?.onPanelVisualizationChanged?.(panel.state.key ?? '', options.pluginId);
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
