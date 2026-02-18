import { css } from '@emotion/css';
import { useState, useCallback, useMemo } from 'react';

import { GrafanaTheme2, PanelData, PanelPluginVisualizationSuggestion, VisualizationSuggestion } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Text, useStyles2 } from '@grafana/ui';

import { VisualizationCardGrid } from './VisualizationCardGrid';

export interface Props {
  presets: VisualizationSuggestion[];
  data: PanelData;
  suggestion: PanelPluginVisualizationSuggestion;
  onPreview: (preset: VisualizationSuggestion) => void;
  onApply: (preset: VisualizationSuggestion) => void;
  onSkip: () => void;
}

export function VisualizationPresets({ presets, data, suggestion, onPreview, onApply, onSkip }: Props) {
  const styles = useStyles2(getStyles);
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);

  const presetSuggestions = useMemo((): PanelPluginVisualizationSuggestion[] => {
    return presets.map((preset, index) => ({
      ...suggestion,
      name: preset.name!,
      hash: `preset-${index}`, // @TODO
      description: preset.description,
      options: preset.options ?? suggestion.options,
      fieldConfig: preset.fieldConfig ?? suggestion.fieldConfig,
      cardOptions: preset.cardOptions ?? suggestion.cardOptions,
    }));
  }, [presets, suggestion]);

  const handlePresetClick = useCallback(
    (presetSuggestion: PanelPluginVisualizationSuggestion, index: number) => {
      setSelectedPresetIndex(index);
      onPreview(presets[index]);
    },
    [onPreview, presets]
  );

  const handleApplyClick = useCallback(
    (presetSuggestion: PanelPluginVisualizationSuggestion, index: number) => {
      onApply(presets[index]);
    },
    [onApply, presets]
  );

  return (
    <>
      <div className={styles.header}>
        <Text element="p" variant="body">
          {t('panel.presets.select-style', 'Select a style')}
        </Text>
        <Button variant="primary" fill="text" onClick={onSkip}>
          {t('panel.presets.skip', 'Skip')}
        </Button>
      </div>

      <VisualizationCardGrid
        items={presetSuggestions}
        data={data}
        selectedItemKey={presetSuggestions[selectedPresetIndex]?.hash ?? null}
        onItemClick={handlePresetClick}
        onItemApply={handleApplyClick}
        getItemKey={(item) => item.hash}
        buttonLabel={t('panel.presets.edit', 'Edit')}
        getButtonAriaLabel={(item) =>
          t('panel.presets.edit-aria-label', 'Edit with {{presetName}} preset', {
            presetName: item.name,
          })
        }
      />
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    header: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing(2),
      paddingBottom: theme.spacing(1),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
  };
};
