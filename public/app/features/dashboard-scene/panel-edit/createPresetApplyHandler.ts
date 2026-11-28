import { type FieldConfigSource, type PanelPluginVisualizationSuggestion } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';

import { edit } from '../actions/utils/edit';

// Apart from the panel options editor, which pulls in serialization, so quick edits can apply presets without it.
export function createPresetApplyHandler(panel: VizPanel) {
  return function onApplyPreset(preset: PanelPluginVisualizationSuggestion, prevFieldConfig: FieldConfigSource) {
    const prevOptions = panel.state.options;
    edit({
      meta: { actionId: 'panel.applyPreset' },
      description: t('dashboard.edit-actions.panel-preset', 'Apply panel preset'),
      source: panel,
      perform: () => applyPreset(panel, preset),
      undo: () => {
        panel.onFieldConfigChange(prevFieldConfig, true);
        if (preset.options) {
          panel.onOptionsChange(prevOptions, true);
        }
      },
    });
  };
}

/** Applies the preset to the panel as it is, without recording an edit. */
export function applyPreset(panel: VizPanel, preset: PanelPluginVisualizationSuggestion) {
  if (preset.fieldConfig) {
    const { defaults, overrides } = panel.state.fieldConfig;
    const presetDefaults = preset.fieldConfig.defaults;
    panel.onFieldConfigChange(
      {
        defaults: {
          ...defaults,
          ...presetDefaults,
          custom: { ...defaults.custom, ...presetDefaults?.custom },
          ...(presetDefaults?.color && { color: presetDefaults.color }),
          ...(presetDefaults?.thresholds && { thresholds: presetDefaults.thresholds }),
        },
        overrides,
      },
      true
    );
  }
  if (preset.options) {
    panel.onOptionsChange({ ...panel.state.options, ...preset.options }, true);
  }
}
