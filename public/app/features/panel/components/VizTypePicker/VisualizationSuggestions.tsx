import { css } from '@emotion/css';
import { Fragment, useState, useEffect, useCallback, useMemo } from 'react';
import { useAsync, useMeasure } from 'react-use';

import {
  GrafanaTheme2,
  PanelData,
  PanelModel,
  PanelPluginMeta,
  PanelPluginVisualizationSuggestion,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, Button, Icon, Spinner, Text, useStyles2 } from '@grafana/ui';
import { UNCONFIGURED_PANEL_PLUGIN_ID } from 'app/features/dashboard-scene/scene/UnconfiguredPanel';

import { getAllPanelPluginMeta } from '../../state/util';
import { MIN_MULTI_COLUMN_SIZE } from '../../suggestions/constants';
import { getAllSuggestions } from '../../suggestions/getAllSuggestions';
import { hasData } from '../../suggestions/utils';

import { VisualizationSuggestionCard } from './VisualizationSuggestionCard';
import { VizTypeChangeDetails } from './types';

export interface Props {
  onChange: (options: VizTypeChangeDetails) => void;
  data?: PanelData;
  panel?: PanelModel;
}

export function VisualizationSuggestions({ onChange, data, panel }: Props) {
  const styles = useStyles2(getStyles);
  const {
    value: suggestions,
    loading,
    error,
  } = useAsync(async () => {
    if (!hasData(data)) {
      return [];
    }

    return await getAllSuggestions(data);
  }, [data]);
  const [suggestionHash, setSuggestionHash] = useState<string | null>(null);
  const [firstCardRef, { width }] = useMeasure<HTMLDivElement>();
  const [firstCardHash, setFirstCardHash] = useState<string | null>(null);
  const isNewVizSuggestionsEnabled = config.featureToggles.newVizSuggestions;
  const isUnconfiguredPanel = panel?.type === UNCONFIGURED_PANEL_PLUGIN_ID;

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
    (suggestion: PanelPluginVisualizationSuggestion, isPreview?: boolean) => {
      onChange({
        pluginId: suggestion.pluginId,
        options: suggestion.options,
        fieldConfig: suggestion.fieldConfig,
        withModKey: isPreview,
      });

      if (isPreview) {
        setSuggestionHash(suggestion.hash);
      }
    },
    [onChange]
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
      applySuggestion(suggestions[0], true);
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
    <div className={styles.grid}>
      {isNewVizSuggestionsEnabled
        ? suggestionsByVizType.map(([vizType, vizTypeSuggestions], groupIndex) => (
            <Fragment key={vizType?.id || `unknown-viz-type-${groupIndex}`}>
              <div className={styles.vizTypeHeader}>
                <Text variant="body" weight="medium">
                  {vizType?.info && <img className={styles.vizTypeLogo} src={vizType.info.logos.small} alt="" />}
                  {vizType?.name || t('panel.visualization-suggestions.unknown-viz-type', 'Unknown visualization type')}
                </Text>
              </div>
              {vizTypeSuggestions?.map((suggestion, index) => {
                const isCardSelected = suggestionHash === suggestion.hash;
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
                        applySuggestion(suggestion, isNewVizSuggestionsEnabled && !isCardSelected);
                      }
                    }}
                    ref={index === 0 ? firstCardRef : undefined}
                  >
                    {isCardSelected && (
                      <Button
                        // rather than allow direct focus, we handle ketboard events in the card.
                        tabIndex={-1}
                        variant="primary"
                        size={'md'}
                        className={styles.applySuggestionButton}
                        aria-label={t(
                          'panel.visualization-suggestions.apply-suggestion-aria-label',
                          'Apply {{suggestionName}} visualization',
                          { suggestionName: suggestion.name }
                        )}
                        onClick={() =>
                          onChange({
                            pluginId: suggestion.pluginId,
                            withModKey: false,
                          })
                        }
                      >
                        {t('panel.visualization-suggestions.use-this-suggestion', 'Use this suggestion')}
                      </Button>
                    )}
                    <VisualizationSuggestionCard
                      data={data}
                      suggestion={suggestion}
                      width={width}
                      isSelected={isCardSelected}
                      onClick={() => applySuggestion(suggestion, true)}
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
                onClick={() => applySuggestion(suggestion)}
              />
            </div>
          ))}
    </div>
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
