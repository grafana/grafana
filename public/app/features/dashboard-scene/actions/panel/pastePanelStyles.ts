import { t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { edit } from '../utils/edit';

type PanelStyles = Pick<VizPanel['state'], 'fieldConfig' | 'options'>;

export function pastePanelStyles(dashboard: DashboardScene, panel: VizPanel) {
  // Nothing gets pasted then, the paste still runs to report errors
  if (!DashboardScene.hasPanelStylesToPaste(panel.state.pluginId)) {
    dashboard.pastePanelStyles(panel);
    return;
  }

  const stylesBefore: PanelStyles = { fieldConfig: panel.state.fieldConfig, options: panel.state.options };
  let stylesAfter: PanelStyles | undefined;

  edit({
    meta: { actionId: 'panel.pasteStyles' },
    description: t('dashboard.edit-actions.paste-panel-styles', 'Paste panel styles'),
    source: panel,
    perform: () => {
      // Redo re-applies the styles pasted the first time, the copied styles may have changed since
      if (stylesAfter) {
        applyPanelStyles(panel, stylesAfter);
        return;
      }

      dashboard.pastePanelStyles(panel);
      stylesAfter = { fieldConfig: panel.state.fieldConfig, options: panel.state.options };
    },
    undo: () => applyPanelStyles(panel, stylesBefore),
  });
}

function applyPanelStyles(panel: VizPanel, { fieldConfig, options }: PanelStyles) {
  panel.onFieldConfigChange(fieldConfig, true);
  panel.onOptionsChange(options, true);
}
