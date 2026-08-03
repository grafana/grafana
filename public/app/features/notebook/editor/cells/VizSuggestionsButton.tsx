import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2, type PanelData, type PanelPluginVisualizationSuggestion } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, Spinner, Text, Toggletip, useStyles2 } from '@grafana/ui';
import { VisualizationSuggestionCard } from 'app/features/panel/components/VizTypePicker/VisualizationSuggestionCard';
import { getAllSuggestions } from 'app/features/panel/suggestions/getAllSuggestions';

const CARD_WIDTH = 150;
const MAX_SUGGESTIONS = 8;
const DATA_POLL_INTERVAL_MS = 250;
const DATA_POLL_TIMEOUT_MS = 10000;

interface Props {
  currentPluginId: string;
  /** Reads the panel's latest query result — suggestions are ranked against real data. */
  getData: () => PanelData | undefined;
  onSelect: (suggestion: PanelPluginVisualizationSuggestion) => void;
}

/**
 * "Change visualization" for a notebook panel: a small icon that opens Grafana's
 * data-driven visualization suggestions (live previews rendered against the
 * panel's current data). Picking one swaps the panel's viz while keeping queries.
 */
export function VizSuggestionsButton({ currentPluginId, getData, onSelect }: Props) {
  return (
    <Toggletip
      content={<SuggestionsContent currentPluginId={currentPluginId} getData={getData} onSelect={onSelect} />}
      placement="bottom-end"
      closeButton={false}
    >
      <IconButton
        name="chart-line"
        size="sm"
        tooltip={t('notebooks.viz-suggestions.tooltip', 'Change visualization')}
      />
    </Toggletip>
  );
}

function SuggestionsContent({ currentPluginId, getData, onSelect }: Props) {
  const styles = useStyles2(getStyles);
  const [data, setData] = useState(getData);
  const [suggestions, setSuggestions] = useState<PanelPluginVisualizationSuggestion[] | undefined>();

  useEffect(() => {
    if (data?.series.length) {
      return;
    }

    const startedAt = Date.now();
    const interval = setInterval(() => {
      const latest = getData();
      if (latest) {
        setData({ ...latest });
      }
      if (latest?.series.length || Date.now() - startedAt >= DATA_POLL_TIMEOUT_MS) {
        clearInterval(interval);
      }
    }, DATA_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [data?.series.length, getData]);

  useEffect(() => {
    if (!data?.series.length) {
      setSuggestions(undefined);
      return;
    }

    let cancelled = false;
    getAllSuggestions(data.series).then((result) => {
      if (!cancelled) {
        setSuggestions(result.suggestions.slice(0, MAX_SUGGESTIONS));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [data]);

  if (!data || data.series.length === 0) {
    return (
      <Text color="secondary">
        {t('notebooks.viz-suggestions.no-data', 'No data yet — suggestions appear once the panel has results.')}
      </Text>
    );
  }

  if (!suggestions) {
    return <Spinner />;
  }

  if (suggestions.length === 0) {
    return <Text color="secondary">{t('notebooks.viz-suggestions.none', 'No suggestions for this data shape.')}</Text>;
  }

  return (
    <div className={styles.grid} data-testid="notebook-viz-suggestions">
      {suggestions.map((suggestion, index) => (
        <VisualizationSuggestionCard
          key={index}
          data={data}
          suggestion={suggestion}
          width={CARD_WIDTH}
          isSelected={suggestion.pluginId === currentPluginId}
          onClick={() => onSelect(suggestion)}
        />
      ))}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  grid: css({
    display: 'grid',
    gridTemplateColumns: `repeat(2, ${CARD_WIDTH}px)`,
    gap: theme.spacing(1),
    maxHeight: 420,
    overflowY: 'auto',
    padding: theme.spacing(0.5),
  }),
});
