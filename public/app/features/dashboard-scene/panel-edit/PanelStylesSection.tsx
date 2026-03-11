import { useCallback, useMemo, useState } from 'react';

import { FeatureState, FieldConfigSource, PanelPluginVisualizationSuggestion } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { sceneGraph, VizPanel } from '@grafana/scenes';
import { FeatureBadge, Stack } from '@grafana/ui';
import { OptionsPaneCategory } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';
import { VisualizationCardGrid } from 'app/features/panel/components/VizTypePicker/VisualizationCardGrid';
import { VizSuggestionsInteractions } from 'app/features/panel/components/VizTypePicker/interactions';
import { getPluginPresets } from 'app/features/panel/presets/getPresets';
import { MIN_MULTI_COLUMN_SIZE } from 'app/features/panel/suggestions/constants';

export interface PanelStylesSectionProps {
  panel: VizPanel;
  onApplyPreset: (preset: PanelPluginVisualizationSuggestion, prevFieldConfig: FieldConfigSource) => void;
}

export function PanelStylesSection({ panel, onApplyPreset }: PanelStylesSectionProps) {
  const [selectedPreset, setSelectedPreset] = useState<string | undefined>(undefined);
  const { data } = sceneGraph.getData(panel).useState();

  const plugin = panel.getPlugin();
  const presets = useMemo(() => (plugin ? getPluginPresets(plugin) : null), [plugin]);

  const handlePresetApply = useCallback(
    (preset: PanelPluginVisualizationSuggestion, index: number) => {
      VizSuggestionsInteractions.presetApplied({
        pluginId: preset.pluginId,
        presetName: preset.name,
        presetIndex: index + 1,
      });
      setSelectedPreset(preset.hash);
      if (preset.fieldConfig || preset.options) {
        onApplyPreset(preset, panel.state.fieldConfig);
      }
    },
    [onApplyPreset, panel]
  );

  if (!presets || presets.length === 0 || !data || data.series.length === 0) {
    return null;
  }

  return (
    <OptionsPaneCategory
      id="panel-styles"
      title={t('dashboard-scene.panel-styles.title', 'Panel styles')}
      isOpenDefault={true}
      renderTitle={() => (
        <Stack direction="row" alignItems="center" gap={1}>
          <Trans i18nKey="dashboard-scene.panel-styles.title">Panel styles</Trans>
          <FeatureBadge featureState={FeatureState.new} />
        </Stack>
      )}
    >
      <VisualizationCardGrid
        items={presets}
        data={data}
        onItemClick={(preset, index) => handlePresetApply(preset, index)}
        getItemKey={(preset) => preset.hash}
        selectedKey={selectedPreset}
        minColumnWidth={120}
        maxCardWidth={MIN_MULTI_COLUMN_SIZE}
      />
    </OptionsPaneCategory>
  );
}
