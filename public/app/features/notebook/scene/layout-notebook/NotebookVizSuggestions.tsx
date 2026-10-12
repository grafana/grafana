import { css } from '@emotion/css';
import { useAsync } from 'react-use';

import { type GrafanaTheme2, type PanelPluginVisualizationSuggestion } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { Alert, useStyles2 } from '@grafana/ui';
import { VisualizationSuggestionCard } from 'app/features/panel/components/VizTypePicker/VisualizationSuggestionCard';
import { getAllSuggestions } from 'app/features/panel/suggestions/getAllSuggestions';

export function NotebookVizSuggestions({
  panel,
  onSelect,
}: {
  panel: VizPanel;
  onSelect: (suggestion: PanelPluginVisualizationSuggestion) => void;
}) {
  const styles = useStyles2(getStyles);
  const { data } = sceneGraph.getData(panel).useState();
  const { value, loading, error } = useAsync(async () => {
    if (!data?.series.length) {
      return [];
    }
    const result = await getAllSuggestions(data.series);
    return result.suggestions.slice(0, 6);
  }, [data?.series]);

  return (
    <div className={styles.container}>
      <div className={styles.title}>{t('notebook.viz.suggested', 'Suggested visualizations')}</div>
      {loading && <div>{t('notebook.viz.loading', 'Loading suggestions…')}</div>}
      {error && <Alert severity="error" title={t('notebook.viz.failed', 'Could not load suggestions')} />}
      {!loading && !error && !value?.length && (
        <div>{t('notebook.viz.no-data', 'Run a query with data to see visualization suggestions.')}</div>
      )}
      {data && (
        <div className={styles.grid}>
          {value?.map((suggestion, index) => (
            <div key={`${suggestion.pluginId}-${index}`}>
              <VisualizationSuggestionCard
                data={data}
                suggestion={suggestion}
                width={150}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(suggestion)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(suggestion);
                  }
                }}
              />
              <div className={styles.caption}>{suggestion.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({ width: 316, maxWidth: 'calc(100vw - 48px)' }),
  title: css({ fontWeight: theme.typography.fontWeightMedium, margin: `${theme.spacing(1)} 0` }),
  grid: css({ display: 'grid', gridTemplateColumns: 'repeat(2, 150px)', gap: theme.spacing(2, 1) }),
  caption: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    marginTop: theme.spacing(0.5),
  }),
});
