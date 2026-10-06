import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2, type PanelData, type PanelPluginVisualizationSuggestion } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { IconButton, Spinner, Text, Toggletip, useStyles2 } from '@grafana/ui';
import { VisualizationSuggestionCard } from 'app/features/panel/components/VizTypePicker/VisualizationSuggestionCard';
import { getAllSuggestions } from 'app/features/panel/suggestions/getAllSuggestions';

import { type NotebookCellItem } from './NotebookCellItem';

const SUGGESTION_CARD_WIDTH = 150;
// Enough to fill the popover with a couple of rows without turning it into a full picker - the
// notebook isn't trying to replace the panel editor's own "All visualizations" tab.
const MAX_SUGGESTIONS = 6;

export function VizSuggestionsButton({ cell, panel }: { cell: NotebookCellItem; panel: VizPanel }) {
  const [open, setOpen] = useState(false);

  return (
    <Toggletip
      show={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      placement="bottom-end"
      closeButton={false}
      content={<SuggestionsList cell={cell} panel={panel} onPick={() => setOpen(false)} />}
    >
      <IconButton
        name="chart-line"
        size="sm"
        tooltip={t('notebook.cell.panel.change-visualization', 'Change visualization')}
      />
    </Toggletip>
  );
}

interface SuggestionsResult {
  suggestions: PanelPluginVisualizationSuggestion[];
  // getAllSuggestions resolves with this rather than rejecting when a plugin fails to load or throws
  // while building its suggestions - a rejection only happens for something unrelated going wrong.
  hasErrors: boolean;
}

function SuggestionsList({ cell, panel, onPick }: { cell: NotebookCellItem; panel: VizPanel; onPick: () => void }) {
  const styles = useStyles2(getStyles);
  const { data } = sceneGraph.getData(panel).useState();
  const [result, setResult] = useState<SuggestionsResult>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    setResult(undefined);
    setFailed(false);

    if (!data?.series.length) {
      return;
    }

    getAllSuggestions(data.series)
      .then((loaded) => {
        if (current) {
          setResult({ suggestions: loaded.suggestions.slice(0, MAX_SUGGESTIONS), hasErrors: loaded.hasErrors });
        }
      })
      .catch(() => {
        if (current) {
          setFailed(true);
        }
      });

    return () => {
      current = false;
    };
  }, [data?.series]);

  if (!data?.series.length) {
    return (
      <Text color="secondary">
        {t('notebook.cell.panel.suggestions-no-data', 'Run a query to see visualization suggestions.')}
      </Text>
    );
  }

  // Treated the same as a rejection: either nothing loaded at all, or every plugin that might have
  // suggested something failed to.
  if (failed || (result && result.hasErrors && result.suggestions.length === 0)) {
    return (
      <Text color="secondary">
        {t('notebook.cell.panel.suggestions-error', 'Could not load visualization suggestions.')}
      </Text>
    );
  }

  if (!result) {
    return <Spinner />;
  }

  if (result.suggestions.length === 0) {
    return (
      <Text color="secondary">
        {t('notebook.cell.panel.suggestions-empty', 'No visualization suggestions for this data.')}
      </Text>
    );
  }

  return (
    <div>
      {result.hasErrors && (
        <Text color="secondary" variant="bodySmall">
          {t('notebook.cell.panel.suggestions-partial-error', 'Some visualization suggestions could not be loaded.')}
        </Text>
      )}
      <div className={styles.grid}>
        {result.suggestions.map((suggestion) => (
          <SuggestionCard key={suggestion.hash} cell={cell} data={data} suggestion={suggestion} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}

function SuggestionCard({
  cell,
  data,
  suggestion,
  onPick,
}: {
  cell: NotebookCellItem;
  data: PanelData;
  suggestion: PanelPluginVisualizationSuggestion;
  onPick: () => void;
}) {
  const apply = () => {
    cell.onVisualizationChange(suggestion);
    onPick();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={suggestion.name}
      onClick={apply}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          apply();
        }
      }}
    >
      <VisualizationSuggestionCard data={data} suggestion={suggestion} width={SUGGESTION_CARD_WIDTH} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  grid: css({
    display: 'grid',
    gridTemplateColumns: `repeat(2, ${SUGGESTION_CARD_WIDTH}px)`,
    gap: theme.spacing(1),
    maxHeight: 420,
    overflowY: 'auto',
    padding: theme.spacing(0.5),
  }),
});
