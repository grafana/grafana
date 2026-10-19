import { css } from '@emotion/css';
import { type RefObject, useEffect, useState } from 'react';

import { type GrafanaTheme2, type PanelPluginVisualizationSuggestion } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { IconButton, Spinner, Stack, Text, Toggletip, useStyles2 } from '@grafana/ui';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/getQueryRunnerFor';
import { VisualizationSuggestionCard } from 'app/features/panel/components/VizTypePicker/VisualizationSuggestionCard';
import { getAllSuggestions } from 'app/features/panel/suggestions/getAllSuggestions';

import { type NotebookCellItem } from './NotebookCellItem';

export function VizSuggestionsButton({
  cell,
  panel,
  lastSuggestedQuery,
  autoSuggest,
}: {
  cell: NotebookCellItem;
  panel: VizPanel;
  lastSuggestedQuery?: RefObject<DataQuery | undefined>;
  autoSuggest?: RefObject<boolean>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Toggletip
      show={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      content={
        <SuggestionsContent
          cell={cell}
          panel={panel}
          lastSuggestedQuery={lastSuggestedQuery}
          autoSuggest={autoSuggest}
          onSelect={() => setOpen(false)}
        />
      }
      placement="bottom-end"
      closeButton={false}
    >
      <IconButton
        name="chart-line"
        size="sm"
        tooltip={t('notebooks.panel.change-visualization', 'Change visualization')}
      />
    </Toggletip>
  );
}

function SuggestionsContent({
  cell,
  panel,
  lastSuggestedQuery,
  autoSuggest,
  onSelect,
}: {
  cell: NotebookCellItem;
  panel: VizPanel;
  lastSuggestedQuery?: RefObject<DataQuery | undefined>;
  autoSuggest?: RefObject<boolean>;
  onSelect: () => void;
}) {
  const styles = useStyles2(getStyles);
  const { data } = sceneGraph.getData(panel).useState();
  const [suggestions, setSuggestions] = useState<PanelPluginVisualizationSuggestion[]>();
  const [loadError, setLoadError] = useState(false);
  const [changeError, setChangeError] = useState(false);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSuggestions(undefined);
    setLoadError(false);
    setChangeError(false);
    if (data?.series.length) {
      void getAllSuggestions(data.series)
        .then((result) => {
          if (!cancelled) {
            setSuggestions(result.suggestions.slice(0, 6));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLoadError(true);
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [data?.series]);

  if (!data?.series.length) {
    return <Text color="secondary">{t('notebooks.panel.suggestions-no-data', 'Run a query to see suggestions.')}</Text>;
  }
  if (loadError) {
    return <Text color="secondary">{t('notebooks.panel.suggestions-error', 'Could not load suggestions.')}</Text>;
  }
  if (!suggestions) {
    return <Spinner />;
  }
  if (suggestions.length === 0) {
    return <Text color="secondary">{t('notebooks.panel.suggestions-empty', 'No suggestions for this data.')}</Text>;
  }

  return (
    <Stack direction="column" gap={1}>
      {changeError && (
        <div role="alert">
          <Text color="error">
            {t('notebooks.panel.visualization-error', 'Could not change visualization. Try again.')}
          </Text>
        </div>
      )}
      <div className={styles.suggestions} aria-busy={changing}>
        {suggestions.map((suggestion, index) => (
          <div key={`${suggestion.pluginId}-${index}`}>
            <VisualizationSuggestionCard
              data={data}
              suggestion={suggestion}
              width={150}
              role="button"
              tabIndex={0}
              aria-disabled={changing}
              onKeyDownCapture={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.currentTarget.click();
                }
              }}
              onClick={() => {
                if (changing) {
                  return;
                }
                const selectedQuery = getQueryRunnerFor(panel)?.state.queries[0];
                if (autoSuggest) {
                  autoSuggest.current = false;
                }
                setChanging(true);
                setChangeError(false);
                void cell
                  .onVisualizationChange(suggestion)
                  .then(() => {
                    if (lastSuggestedQuery) {
                      lastSuggestedQuery.current = selectedQuery;
                    }
                    onSelect();
                  })
                  .catch(() => setChangeError(true))
                  .finally(() => setChanging(false));
              }}
            />
            <div className={styles.suggestionLabel}>{suggestion.name}</div>
          </div>
        ))}
      </div>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  suggestions: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, 150px)',
    justifyContent: 'center',
    width: 316,
    maxWidth: `calc(100vw - ${theme.spacing(6)})`,
    gap: theme.spacing(1),
    maxHeight: `min(420px, calc(50dvh - ${theme.spacing(10)}))`,
    overflowY: 'auto',
    padding: theme.spacing(0.5),
  }),
  suggestionLabel: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    marginTop: theme.spacing(0.5),
  }),
});
