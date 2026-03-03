import { useCallback, useEffect, useState } from 'react';

import { FeatureState, FieldConfigSource, PanelPluginVisualizationSuggestion } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { sceneGraph, VizPanel } from '@grafana/scenes';
import { FeatureBadge, Stack } from '@grafana/ui';
import { OptionsPaneCategory } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';
import { VisualizationCardGrid } from 'app/features/panel/components/VizTypePicker/VisualizationCardGrid';
import { getPresets } from 'app/features/panel/presets/getPresets';

export interface PanelStylesSectionProps {
  panel: VizPanel;
  onApplyPreset: (preset: PanelPluginVisualizationSuggestion, prevFieldConfig: FieldConfigSource) => void;
}

export function PanelStylesSection({ panel, onApplyPreset }: PanelStylesSectionProps) {
  const [presets, setPresets] = useState<PanelPluginVisualizationSuggestion[] | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | undefined>(undefined);
  const { pluginId } = panel.useState();
  const { data } = sceneGraph.getData(panel).useState();

  useEffect(() => {
    let cancelled = false;
    setPresets(null);
    setSelectedPreset(undefined);
    getPresets(pluginId, panel.state.fieldConfig)
      .then((loadedPresets) => {
        if (!cancelled) {
          setPresets(loadedPresets ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPresets([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pluginId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePresetApply = useCallback(
    (preset: PanelPluginVisualizationSuggestion) => {
      setSelectedPreset(preset.hash);
      if (preset.fieldConfig) {
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
        onItemClick={(preset) => handlePresetApply(preset)}
        getItemKey={(preset) => preset.hash}
        selectedKey={selectedPreset}
        minColumnWidth={120}
      />
    </OptionsPaneCategory>
  );
}
