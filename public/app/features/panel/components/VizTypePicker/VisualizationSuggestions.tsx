import { css } from '@emotion/css';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAsyncRetry } from 'react-use';

import {
  GrafanaTheme2,
  PanelData,
  PanelModel,
  PanelPluginMeta,
  PanelPluginVisualizationSuggestion,
  VisualizationSuggestion,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { Alert, Button, Icon, Spinner, Text, useStyles2 } from '@grafana/ui';
import { UNCONFIGURED_PANEL_PLUGIN_ID } from 'app/features/dashboard-scene/scene/UnconfiguredPanel';

import { useStructureRev } from '../../../explore/Graph/useStructureRev';
import { getPresetsForPanel } from '../../presets/getPresets';
import { getAllPanelPluginMeta } from '../../state/util';
import { getAllSuggestions } from '../../suggestions/getAllSuggestions';
import { hasData } from '../../suggestions/utils';

import { VisualizationCardGrid, VisualizationCardGridGroup } from './VisualizationCardGrid';
import { VizSuggestionsInteractions, PANEL_STATES, type PanelState } from './interactions';
import { VizTypeChangeDetails } from './types';

export interface Props {
  onChange: (options: VizTypeChangeDetails, panel?: VizPanel) => void;
  data?: PanelData;
  panel?: PanelModel;
  vizPanel?: VizPanel;
  searchQuery?: string;
  isNewPanel?: boolean;
  onShowPresets?: (suggestion: PanelPluginVisualizationSuggestion, presets: VisualizationSuggestion[]) => void;
}

const useSuggestions = (data: PanelData | undefined, searchQuery: string | undefined) => {
  const [hasFetched, setHasFetched] = useState(false);
  const structureRev = useStructureRev(data?.series ?? []);

  const { value, loading, error, retry } = useAsyncRetry(async () => {
    await new Promise((resolve) => setTimeout(resolve, hasFetched ? 75 : 0));
    setHasFetched(true);
    return await getAllSuggestions(data?.series);
  }, [hasFetched, structureRev]);

  const filteredValue = useMemo(() => {
    if (!value || !searchQuery) {
      return value;
    }

    const lowerCaseQuery = searchQuery.toLowerCase();
    const filteredSuggestions = value.suggestions.filter(
      (suggestion) =>
        suggestion.name.toLowerCase().includes(lowerCaseQuery) ||
        suggestion.pluginId.toLowerCase().includes(lowerCaseQuery) ||
        suggestion.description?.toLowerCase().includes(lowerCaseQuery)
    );

    return {
      ...value,
      suggestions: filteredSuggestions,
    };
  }, [value, searchQuery]);

  return { value: filteredValue, loading, error, retry };
};

export function VisualizationSuggestions({
  onChange,
  data,
  panel,
  vizPanel,
  searchQuery,
  isNewPanel,
  onShowPresets,
}: Props) {
  const styles = useStyles2(getStyles);

  const { value: result, loading, error, retry } = useSuggestions(data, searchQuery);

  const suggestions = result?.suggestions;
  const hasLoadingErrors = result?.hasErrors ?? false;
  const [suggestionHash, setSuggestionHash] = useState<string | null>(null);
  const [firstCardHash, setFirstCardHash] = useState<string | null>(null);
  const [selectedSuggestionHasPresets, setSelectedSuggestionHasPresets] = useState<boolean>(false);
  const isNewVizSuggestionsEnabled = config.featureToggles.newVizSuggestions;
  const isUnconfiguredPanel =
    vizPanel?.state.pluginId === UNCONFIGURED_PANEL_PLUGIN_ID || panel?.type === UNCONFIGURED_PANEL_PLUGIN_ID;

  const panelState = useMemo((): PanelState => {
    if (isUnconfiguredPanel) {
      return PANEL_STATES.UNCONFIGURED_PANEL;
    }

    if (isNewPanel) {
      return PANEL_STATES.NEW_PANEL;
    }

    return PANEL_STATES.EXISTING_PANEL;
  }, [isUnconfiguredPanel, isNewPanel]);

  const suggestionsByVizType = useMemo((): VisualizationCardGridGroup[] => {
    const meta = getAllPanelPluginMeta();
    const record: Record<string, PanelPluginMeta> = {};
    for (const m of meta) {
      record[m.id] = m;
    }

    const result: VisualizationCardGridGroup[] = [];
    let currentVizType: PanelPluginMeta | undefined = undefined;
    for (const suggestion of suggestions || []) {
      const vizType = record[suggestion.pluginId];
      if (!currentVizType || currentVizType.id !== vizType?.id) {
        currentVizType = vizType;
        result.push({ meta: vizType, items: [] });
      }
      result[result.length - 1].items.push(suggestion);
    }
    return result;
  }, [suggestions]);

  const applySuggestion = useCallback(
    (
      suggestion: PanelPluginVisualizationSuggestion,
      suggestionIndex: number,
      isAutoSelected = false,
      shouldCloseVizPicker = false
    ) => {
      if (shouldCloseVizPicker) {
        VizSuggestionsInteractions.suggestionAccepted({
          pluginId: suggestion.pluginId,
          suggestionName: suggestion.name,
          panelState,
          suggestionIndex: suggestionIndex + 1,
        });
      } else {
        VizSuggestionsInteractions.suggestionPreviewed({
          pluginId: suggestion.pluginId,
          suggestionName: suggestion.name,
          panelState,
          isAutoSelected,
        });

        // Check if this suggestion has presets when it's selected
        if (config.featureToggles.vizPresets && vizPanel) {
          getPresetsForPanel(suggestion.pluginId, vizPanel)
            .then((presetsResult) => {
              setSelectedSuggestionHasPresets(presetsResult.presets && presetsResult.presets.length > 0);
            })
            .catch(() => {
              setSelectedSuggestionHasPresets(false);
            });
        }
      }

      setSuggestionHash(suggestion.hash);
      onChange({
        pluginId: suggestion.pluginId,
        options: suggestion.options,
        fieldConfig: suggestion.fieldConfig,
        withModKey: !shouldCloseVizPicker,
        fromSuggestions: true,
      });
    },
    [onChange, panelState, vizPanel]
  );

  const handleApplySuggestion = useCallback(
    async (item: PanelPluginVisualizationSuggestion, index: number) => {
      if (config.featureToggles.vizPresets && onShowPresets && vizPanel) {
        try {
          const presetsResult = await getPresetsForPanel(item.pluginId, vizPanel);
          if (presetsResult.presets && presetsResult.presets.length > 0) {
            onShowPresets(item, presetsResult.presets);
            return;
          }
        } catch (error) {
          console.error('Failed to load presets:', error);
        }
      }
      applySuggestion(item, index, false, true);
    },
    [applySuggestion, onShowPresets, vizPanel]
  );

  const getButtonLabel = () => {
    return config.featureToggles.vizPresets && selectedSuggestionHasPresets
      ? t('panel.visualization-suggestions.view-style-options', 'View style options')
      : t('panel.visualization-suggestions.configure-panel', 'Configure panel');
  };

  const getButtonAriaLabelForItem = (item: PanelPluginVisualizationSuggestion) => {
    return config.featureToggles.vizPresets && selectedSuggestionHasPresets
      ? t(
          'panel.visualization-suggestions.view-style-options-aria-label',
          'View style options for {{suggestionName}}',
          {
            suggestionName: item.name,
          }
        )
      : t('panel.visualization-suggestions.configure-panel-aria-label', 'Configure {{suggestionName}} panel', {
          suggestionName: item.name,
        });
  };

  const getSecondaryButtonConfig = () => {
    if (!config.featureToggles.vizPresets || !onShowPresets || !vizPanel) {
      return undefined;
    }

    return {
      onAction: (item: PanelPluginVisualizationSuggestion, index: number) => applySuggestion(item, index, false, true),
      label: t('panel.visualization-suggestions.configure-panel', 'Configure panel'),
      getAriaLabel: (item: PanelPluginVisualizationSuggestion) =>
        t('panel.visualization-suggestions.configure-panel-aria-label', 'Configure {{suggestionName}} panel', {
          suggestionName: item.name,
        }),
      shouldShow: () => selectedSuggestionHasPresets,
    };
  };

  useEffect(() => {
    if (!isNewVizSuggestionsEnabled || !suggestions || suggestions.length === 0) {
      return;
    }

    // Only auto-apply the first suggestion for unconfigured panels.
    // For existing panels, do not auto-select when navigating back to the suggestions tab.
    if (!isUnconfiguredPanel) {
      return;
    }

    // if the first suggestion has changed, we're going to change the currently selected suggestion and
    // set the firstCardHash to the new first suggestion's hash. We also choose the first suggestion if
    // the previously selected suggestion is no longer present in the list.
    const newFirstCardHash = suggestions?.[0]?.hash ?? null;
    if (firstCardHash !== newFirstCardHash || suggestions.every((s) => s.hash !== suggestionHash)) {
      applySuggestion(suggestions[0], 0, true);
      setFirstCardHash(newFirstCardHash);
      return;
    }
  }, [
    suggestions,
    suggestionHash,
    firstCardHash,
    isNewVizSuggestionsEnabled,
    isNewPanel,
    isUnconfiguredPanel,
    applySuggestion,
  ]);

  if (loading || !data) {
    return (
      <div className={styles.loadingContainer}>
        <Spinner size="xxl" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert title={t('panel.visualization-suggestions.error-loading-suggestions.title', 'Error')} severity="error">
        <Trans i18nKey="panel.visualization-suggestions.error-loading-suggestions.message">
          An error occurred when loading visualization suggestions.
        </Trans>
      </Alert>
    );
  }

  if (isNewVizSuggestionsEnabled && (!data || !hasData(data))) {
    return (
      <div className={styles.emptyStateWrapper}>
        <Icon name="chart-line" size="xxxl" className={styles.emptyStateIcon} />
        <Text element="p" textAlignment="center" color="secondary">
          <Trans i18nKey="dashboard.new-panel.suggestions.empty-state-message">
            Run a query to start seeing suggested visualizations
          </Trans>
        </Text>
      </div>
    );
  }

  return (
    <>
      {hasLoadingErrors && (
        <Alert severity="warning" title={''}>
          <div className={styles.alertContent}>
            <Trans i18nKey="panel.visualization-suggestions.error-loading-some-suggestions.message">
              Some suggestions could not be loaded
            </Trans>
            <Button variant="secondary" size="sm" onClick={retry}>
              <Trans i18nKey="panel.visualization-suggestions.error-loading-suggestions.try-again-button">
                Try again
              </Trans>
            </Button>
          </div>
        </Alert>
      )}
      <VisualizationCardGrid
        groups={isNewVizSuggestionsEnabled ? suggestionsByVizType : undefined}
        items={!isNewVizSuggestionsEnabled ? suggestions : undefined}
        data={data!}
        selectedItemKey={suggestionHash}
        onItemClick={(item, index) => applySuggestion(item, index)}
        onItemApply={handleApplySuggestion}
        getItemKey={(item) => item.hash}
        buttonLabel={getButtonLabel()}
        getButtonAriaLabel={getButtonAriaLabelForItem}
        secondaryButton={getSecondaryButtonConfig()}
      />
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    loadingContainer: css({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      marginTop: theme.spacing(6),
    }),
    alertContent: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
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
  };
};
