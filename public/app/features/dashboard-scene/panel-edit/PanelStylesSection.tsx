import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import { type FieldConfigSource, type GrafanaTheme2, type PanelPluginVisualizationSuggestion } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { OptionsPaneCategory } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';
import { VisualizationCardGrid } from 'app/features/panel/components/VizTypePicker/VisualizationCardGrid';
import { VizSuggestionsInteractions } from 'app/features/panel/components/VizTypePicker/interactions';
import { getPluginPresets } from 'app/features/panel/presets/getPresets';
import { MIN_MULTI_COLUMN_SIZE } from 'app/features/panel/suggestions/constants';
import { hasData } from 'app/features/panel/suggestions/utils';

export interface PanelStylesSectionProps {
  panel: VizPanel;
  onApplyPreset: (preset: PanelPluginVisualizationSuggestion, prevFieldConfig: FieldConfigSource) => void;
}

function presetModifiesThresholds(preset: PanelPluginVisualizationSuggestion): boolean {
  return Boolean(preset.fieldConfig?.defaults?.thresholds);
}

/** The panel's style presets and the data to preview them with, or null while there is nothing to show. */
export function usePanelStylePresets(panel: VizPanel) {
  const { data } = sceneGraph.getData(panel).useState();
  const plugin = panel.getPlugin();
  const presets = useMemo(() => (plugin ? getPluginPresets(plugin, data?.series) : null), [plugin, data]);

  if (!presets || presets.length === 0 || !data || !hasData(data)) {
    return null;
  }
  return { presets, data };
}

export function PanelStylesSection({ panel, onApplyPreset }: PanelStylesSectionProps) {
  const available = usePanelStylePresets(panel);

  if (!available) {
    return null;
  }

  return (
    <OptionsPaneCategory
      id="panel-styles"
      title={t('dashboard-scene.panel-styles.title', 'Panel styles')}
      isOpenDefault={true}
    >
      <PanelStylesGrid panel={panel} onApplyPreset={onApplyPreset} {...available} />
    </OptionsPaneCategory>
  );
}

interface PanelStylesGridProps extends PanelStylesSectionProps, NonNullable<ReturnType<typeof usePanelStylePresets>> {}

/** The preset cards on their own, for surfaces that give them their own heading. */
export function PanelStylesGrid({ panel, presets, data, onApplyPreset }: PanelStylesGridProps) {
  const styles = useStyles2(getStyles);
  const [selectedPreset, setSelectedPreset] = useState<string | undefined>(undefined);

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

  const getThresholdBadge = (preset: PanelPluginVisualizationSuggestion) => {
    if (!presetModifiesThresholds(preset)) {
      return null;
    }
    return (
      <Tooltip
        content={t('dashboard-scene.panel-styles.threshold-badge-tooltip', 'This preset will modify thresholds')}
      >
        <div
          className={styles.thresholdBadge}
          aria-label={t('dashboard-scene.panel-styles.threshold-badge-tooltip', 'This preset will modify thresholds')}
        >
          <Icon name="sliders-v-alt" size="xs" />
        </div>
      </Tooltip>
    );
  };

  return (
    <VisualizationCardGrid
      items={presets}
      data={data}
      onItemClick={(preset, index) => handlePresetApply(preset, index)}
      getItemKey={(preset) => preset.hash}
      selectedKey={selectedPreset}
      minColumnWidth={120}
      maxCardWidth={MIN_MULTI_COLUMN_SIZE}
      getBadge={getThresholdBadge}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  thresholdBadge: css({
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(0.5),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: theme.spacing(2.5),
    height: theme.spacing(2.5),
    borderRadius: theme.shape.radius.circle,
    background: theme.colors.background.canvas,
    border: `1px solid ${theme.colors.border.medium}`,
    color: theme.colors.text.secondary,
    cursor: 'default',
    zIndex: 1,
  }),
});
