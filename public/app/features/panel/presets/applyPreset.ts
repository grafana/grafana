import { VisualizationSuggestion } from '@grafana/data';
import { VizPanel } from '@grafana/scenes';

/**
 * Applies a preset to a panel
 * @TODO
 */
export function applyPresetToPanel(panel: VizPanel, preset: VisualizationSuggestion, isPreview = false): void {
  if (preset.options) {
    panel.onOptionsChange(preset.options, !isPreview);
  }

  if (preset.fieldConfig) {
    const mergedFieldConfig = {
      ...preset.fieldConfig,
      overrides: panel.state.fieldConfig.overrides,
    };
    panel.onFieldConfigChange(mergedFieldConfig, !isPreview);
  }
}
