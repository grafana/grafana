import { css } from '@emotion/css';
import { Fragment, useState, useEffect, useCallback, useMemo } from 'react';
import { useAsyncRetry, useMeasure } from 'react-use';

import {
  GrafanaTheme2,
  PanelData,
  PanelModel,
  PanelPluginMeta,
  PanelPluginVisualizationSuggestion,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { Alert, Button, Icon, Spinner, Text, useStyles2 } from '@grafana/ui';
import { UNCONFIGURED_PANEL_PLUGIN_ID } from 'app/features/dashboard-scene/scene/UnconfiguredPanel';

import { getAllPanelPluginMeta } from '../../state/util';
import { MIN_MULTI_COLUMN_SIZE } from '../../suggestions/constants';
import { getAllSuggestions } from '../../suggestions/getAllSuggestions';
import { hasData } from '../../suggestions/utils';

import { VisualizationSuggestionCard } from './VisualizationSuggestionCard';
import { VizSuggestionsInteractions, PANEL_STATES, type PanelState } from './interactions';
import { VizTypeChangeDetails } from './types';

export interface Props {
  onChange: (options: VizTypeChangeDetails, panel?: VizPanel) => void;
  editPreview?: VizPanel;
  data?: PanelData;
  panel?: PanelModel;
  searchQuery?: string;
  isNewPanel?: boolean;
}

const useSuggestions = (data: PanelData | undefined, searchQuery: string | undefined) => {
  const [hasFetched, setHasFetched] = useState(false);
  const { value, loading, error, retry } = useAsyncRetry(async () => {
    await new Promise((resolve) => setTimeout(resolve, hasFetched ? 75 : 0));
    setHasFetched(true);
    return await getAllSuggestions(data);
  }, [hasFetched, data]);

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

export function VisualizationSuggestions({ onChange, editPreview, data, panel, searchQuery, isNewPanel }: Props) {
  const styles = useStyles2(getStyles);

  const { value: result, loading, error, retry } = useSuggestions(data, searchQuery);

  const suggestions = result?.suggestions;
  const hasLoadingErrors = result?.hasErrors ?? false;
  const [suggestionHash, setSuggestionHash] = useState<string | null>(null);
  const [firstCardRef, { width }] = useMeasure<HTMLDivElement>();
  const [firstCardHash, setFirstCardHash] = useState<string | null>(null);
  const isNewVizSuggestionsEnabled = config.featureToggles.newVizSuggestions;
  const isUnconfiguredPanel = panel?.type === UNCONFIGURED_PANEL_PLUGIN_ID;

  const panelState = useMemo((): PanelState => {
    if (isUnconfiguredPanel) {
      return PANEL_STATES.UNCONFIGURED_PANEL;
    }

    if (isNewPanel) {
      return PANEL_STATES.NEW_PANEL;
    }

    return PANEL_STATES.EXISTING_PANEL;
  }, [isUnconfiguredPanel, isNewPanel]);

  const suggestionsByVizType = useMemo(() => {
    const meta = getAllPanelPluginMeta();
    const record: Record<string, PanelPluginMeta> = {};
    for (const m of meta) {
      record[m.id] = m;
    }

    const result: Array<[PanelPluginMeta | undefined, PanelPluginVisualizationSuggestion[]]> = [];
    let currentVizType: PanelPluginMeta | undefined = undefined;
    for (const suggestion of suggestions || []) {
      const vizType = record[suggestion.pluginId];
      if (!currentVizType || currentVizType.id !== vizType?.id) {
        currentVizType = vizType;
        result.push([vizType, []]);
      }
      result[result.length - 1][1].push(suggestion);
    }
    return result;
  }, [suggestions]);

  const applySuggestion = useCallback(
    (
      suggestion: PanelPluginVisualizationSuggestion,
      isPreview: boolean,
      suggestionIndex: number,
      isAutoSelected = false
    ) => {
      if (isPreview) {
        VizSuggestionsInteractions.suggestionPreviewed({
          pluginId: suggestion.pluginId,
          suggestionName: suggestion.name,
          panelState,
          isAutoSelected,
        });

        setSuggestionHash(suggestion.hash);
      } else {
        VizSuggestionsInteractions.suggestionAccepted({
          pluginId: suggestion.pluginId,
          suggestionName: suggestion.name,
          panelState,
          suggestionIndex: suggestionIndex + 1,
        });
      }

      onChange(
        {
          pluginId: suggestion.pluginId,
          options: suggestion.options,
          fieldConfig: suggestion.fieldConfig,
          withModKey: isPreview,
          fromSuggestions: true,
        },
        isPreview ? editPreview : undefined
      );
    },
    [onChange, editPreview, panelState]
  );

  useEffect(() => {
    if (!isNewVizSuggestionsEnabled || !suggestions || suggestions.length === 0) {
      return;
    }

    // if the first suggestion has changed, we're going to change the currently selected suggestion and
    // set the firstCardHash to the new first suggestion's hash. We also choose the first suggestion if
    // the previously selected suggestion is no longer present in the list.
    const newFirstCardHash = suggestions?.[0]?.hash ?? null;
    if (firstCardHash !== newFirstCardHash || suggestions.every((s) => s.hash !== suggestionHash)) {
      applySuggestion(suggestions[0], true, 0, true);
      setFirstCardHash(newFirstCardHash);
      return;
    }
  }, [suggestions, suggestionHash, firstCardHash, isNewVizSuggestionsEnabled, isUnconfiguredPanel, applySuggestion]);

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
      <div className={styles.grid}>
        {isNewVizSuggestionsEnabled
          ? suggestionsByVizType.map(([vizType, vizTypeSuggestions], groupIndex) => (
              <Fragment key={vizType?.id || `unknown-viz-type-${groupIndex}`}>
                <div className={styles.vizTypeHeader}>
                  <Text variant="body" weight="medium">
                    {vizType?.info && <img className={styles.vizTypeLogo} src={vizType.info.logos.small} alt="" />}
                    {vizType?.name ||
                      t('panel.visualization-suggestions.unknown-viz-type', 'Unknown visualization type')}
                  </Text>
                </div>
                {vizTypeSuggestions?.map((suggestion, index) => {
                  const isCardSelected = suggestionHash === suggestion.hash;
                  const suggestionIndex = suggestions?.findIndex((s) => s.hash === suggestion.hash) ?? -1;
                  return (
                    <div
                      key={suggestion.hash}
                      className={styles.cardContainer}
                      tabIndex={0}
                      role="button"
                      aria-pressed={isCardSelected}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault();
                          applySuggestion(suggestion, isNewVizSuggestionsEnabled && !isCardSelected, suggestionIndex);
                        }
                      }}
                      ref={index === 0 ? firstCardRef : undefined}
                    >
                      {isCardSelected && (
                        <Button
                          // rather than allow direct focus, we handle keyboard events in the card.
                          tabIndex={-1}
                          variant="primary"
                          size={'md'}
                          className={styles.applySuggestionButton}
                          data-testid={selectors.components.VisualizationPreview.confirm(suggestion.name)}
                          aria-label={t(
                            'panel.visualization-suggestions.apply-suggestion-aria-label',
                            'Apply {{suggestionName}} visualization',
                            { suggestionName: suggestion.name }
                          )}
                          onClick={() => applySuggestion(suggestion, false, suggestionIndex)}
                        >
                          {t('panel.visualization-suggestions.use-this-suggestion', 'Use this suggestion')}
                        </Button>
                      )}
                      <VisualizationSuggestionCard
                        data={data}
                        suggestion={suggestion}
                        width={width}
                        isSelected={isCardSelected}
                        onClick={() => applySuggestion(suggestion, true, suggestionIndex)}
                      />
                    </div>
                  );
                })}
              </Fragment>
            ))
          : suggestions?.map((suggestion, index) => (
              <div key={suggestion.hash} className={styles.cardContainer} ref={index === 0 ? firstCardRef : undefined}>
                <VisualizationSuggestionCard
                  key={index}
                  data={data}
                  suggestion={suggestion}
                  width={width}
                  tabIndex={index}
                  onClick={() => applySuggestion(suggestion, false, index)}
                />
              </div>
            ))}
      </div>
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
      gridTemplateColumns: `repeat(auto-fit, minmax(${MIN_MULTI_COLUMN_SIZE}px, 1fr))`,
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
    vizTypeHeader: css({
      gridColumn: '1 / -1',
      marginBottom: theme.spacing(0.5),
      marginTop: theme.spacing(2),
      '&:first-of-type': {
        marginTop: 0,
      },
    }),
    vizTypeLogo: css({
      filter: 'grayscale(100%)',
      maxHeight: `${theme.typography.body.lineHeight}em`,
      width: `${theme.typography.body.lineHeight}em`,
      alignItems: 'center',
      display: 'inline-block',
      marginRight: theme.spacing(1),
    }),
    applySuggestionButton: css({
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 10,
      padding: theme.spacing(0, 2),
    }),
  };
};
