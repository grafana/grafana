import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { FeatureState, type FieldConfigSource, type PanelPluginVisualizationSuggestion } from '@grafana/data/types';
import { t, Trans } from '@grafana/i18n';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { FeatureBadge, Stack, Tooltip } from '@grafana/ui';
import { Icon } from '@grafana/ui/components/icons';
import { useStyles2 } from '@grafana/ui/themes';
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

export function PanelStylesSection({ panel, onApplyPreset }: PanelStylesSectionProps) {
  const styles = useStyles2(getStyles);
  const [selectedPreset, setSelectedPreset] = useState<string | undefined>(undefined);
  const { data } = sceneGraph.getData(panel).useState();

  const plugin = panel.getPlugin();
  const presets = useMemo(() => (plugin ? getPluginPresets(plugin, data?.series) : null), [plugin, data]);

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

  if (!presets || presets.length === 0 || !data || !hasData(data)) {
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
        getBadge={getThresholdBadge}
      />
    </OptionsPaneCategory>
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
