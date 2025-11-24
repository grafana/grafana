import { css } from '@emotion/css';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAsync, useMeasure } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2, PanelData, PanelModel } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, Icon, Text, useStyles2 } from '@grafana/ui';
import { UNCONFIGURED_PANEL_PLUGIN_ID } from 'app/features/dashboard-scene/scene/UnconfiguredPanel';

import { getAllSuggestions } from '../../suggestions/getAllSuggestions';
import { hasData } from '../../suggestions/utils';

import { VisualizationSuggestionCard } from './VisualizationSuggestionCard';
import { VizTypeChangeDetails } from './types';

export interface Props {
  onChange: (options: VizTypeChangeDetails) => void;
  data?: PanelData;
  panel?: PanelModel;
}

const MIN_COLUMN_SIZE = 260;

export function VisualizationSuggestions({ onChange, data, panel }: Props) {
  const styles = useStyles2(getStyles);
  const { value: suggestions } = useAsync(() => getAllSuggestions(data, panel), [data, panel]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [firstCardRef, { width }] = useMeasure<HTMLDivElement>();

  const filteredSuggestions = useMemo(() => suggestions || [], [suggestions]);
  const isNewVizSuggestionsEnabled = config.featureToggles.newVizSuggestions;

  const isUnconfiguredPanel = panel?.type === UNCONFIGURED_PANEL_PLUGIN_ID;

  // auto-select first suggestion when nothing is selected
  useEffect(() => {
    if (isNewVizSuggestionsEnabled && filteredSuggestions.length > 0 && selectedIndex === null && isUnconfiguredPanel) {
      setSelectedIndex(0);
    }
  }, [filteredSuggestions, isNewVizSuggestionsEnabled, isUnconfiguredPanel, selectedIndex]);

  const handleApplySuggestion = useCallback(() => {
    if (selectedIndex !== null && filteredSuggestions[selectedIndex]) {
      const selectedSuggestion = filteredSuggestions[selectedIndex];
      onChange({
        pluginId: selectedSuggestion.pluginId,
        options: selectedSuggestion.options,
        fieldConfig: selectedSuggestion.fieldConfig,
        withModKey: false,
      });
    }
  }, [selectedIndex, filteredSuggestions, onChange]);

  const handleCardSelect = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const renderEmptyState = () => (
    <div className={styles.emptyStateWrapper}>
      <Icon name="chart-line" size="xxxl" className={styles.emptyStateIcon} />
      <Text element="p" textAlignment="center" color="secondary">
        <Trans i18nKey="dashboard.new-panel.suggestions.empty-state-message">
          Run a query to start seeing suggested visualizations
        </Trans>
      </Text>
    </div>
  );

  if (isNewVizSuggestionsEnabled && (!data || !hasData(data))) {
    return renderEmptyState();
  }

  if (!data) {
    return null;
  }

  return (
    // This div is needed in some places to make AutoSizer work
    <div>
      <AutoSizer disableHeight style={{ width: '100%', height: '100%' }}>
        {() => (
          <div>
            <div className={styles.grid}>
              {filteredSuggestions.map((suggestion, index) => {
                const isCardSelected = isNewVizSuggestionsEnabled && selectedIndex === index;
                const cardSelectHandler = isNewVizSuggestionsEnabled ? () => handleCardSelect(index) : undefined;

                return (
                  <div key={index} className={styles.cardContainer} ref={index === 0 ? firstCardRef : undefined}>
                    {isCardSelected && (
                      <Button
                        variant="primary"
                        size={'md'}
                        onClick={handleApplySuggestion}
                        className={styles.applySuggestionButton}
                        aria-label={t(
                          'panel.visualization-suggestions.apply-suggestion-aria-label',
                          'Apply {{suggestionName}} visualization',
                          { suggestionName: suggestion.name }
                        )}
                      >
                        {t('panel.visualization-suggestions.use-this-suggestion', 'Use this suggestion')}
                      </Button>
                    )}
                    <VisualizationSuggestionCard
                      data={data}
                      suggestion={suggestion}
                      onChange={onChange}
                      width={width}
                      isSelected={isCardSelected}
                      onSelect={cardSelectHandler}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </AutoSizer>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    filterRow: css({
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingBottom: '8px',
    }),
    infoText: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
    }),
    grid: css({
      display: 'grid',
      gridGap: theme.spacing(1),
      gridTemplateColumns: `repeat(auto-fit, minmax(${MIN_COLUMN_SIZE}px, 1fr))`,
      marginBottom: theme.spacing(1),
      justifyContent: 'space-evenly',
    }),
    emptyStateWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing(4),
      textAlign: 'center',
      minHeight: '200px',
    }),
    emptyStateIcon: css({
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing(2),
    }),
    cardContainer: css({
      position: 'relative',
    }),
    applySuggestionButton: css({
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 10,
      padding: '0 16px',
    }),
  };
};
