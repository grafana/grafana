import { css, cx } from '@emotion/css';
import { type RefObject, useEffect, useState } from 'react';

import { type GrafanaTheme2, type PanelPluginVisualizationSuggestion } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceInstance } from '@grafana/runtime/unstable';
import { sceneGraph, type SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { IconButton, Input, LinkButton, Spinner, Stack, Text, Toggletip, useStyles2 } from '@grafana/ui';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/getQueryRunnerFor';
import { tryGetExploreUrlForPanel } from 'app/features/dashboard-scene/utils/urlBuilders';
import { isLibraryPanel } from 'app/features/dashboard-scene/utils/utils';
import { VisualizationSuggestionCard } from 'app/features/panel/components/VizTypePicker/VisualizationSuggestionCard';
import { getAllSuggestions } from 'app/features/panel/suggestions/getAllSuggestions';
import { GrafanaQueryType } from 'app/plugins/datasource/grafana/types';

import { type NotebookCellItem } from './NotebookCellItem';
import { NOTEBOOK_CELL_CONTROLS_CLASS } from './edit/cellClassNames';

interface Props {
  cell: NotebookCellItem;
  panel: VizPanel;
  isEditing: boolean;
  lastSuggestedQuery?: RefObject<DataQuery | undefined>;
  autoSuggest?: RefObject<boolean>;
  onToggleQueryEditor?: () => void;
  queryEditorOpen?: boolean;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

export function NotebookPanelActions({
  cell,
  panel,
  isEditing,
  lastSuggestedQuery,
  autoSuggest,
  onToggleQueryEditor,
  queryEditorOpen,
  onDuplicate,
  onDelete,
}: Props) {
  const styles = useStyles2(getStyles);
  const { title } = panel.useState();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(title);
  const [originalTitle, setOriginalTitle] = useState(title);
  const canEditPanel = isEditing && !isLibraryPanel(panel);

  const finishRename = () => {
    cell.onPanelTitleChange(draft.trim());
    cell.onPanelTitleCommit();
    setRenaming(false);
  };

  return (
    <>
      {canEditPanel && renaming && (
        <div className={styles.rename}>
          <Input
            autoFocus
            aria-label={t('notebooks.panel.title-label', 'Panel title')}
            value={draft}
            onChange={(event) => {
              setDraft(event.currentTarget.value);
              cell.onPanelTitleChange(event.currentTarget.value);
            }}
            onBlur={finishRename}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) {
                return;
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                finishRename();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                cell.onPanelTitleChange(originalTitle);
                cell.onPanelTitleCommit();
                setRenaming(false);
              }
            }}
          />
        </div>
      )}
      <div
        className={cx(
          styles.toolbar,
          isEditing ? styles.toolbarEditing : styles.toolbarViewing,
          NOTEBOOK_CELL_CONTROLS_CLASS
        )}
        data-notebook-panel-actions
      >
        <Stack direction="row" gap={0.5} alignItems="center">
          {canEditPanel && onToggleQueryEditor && (
            <IconButton
              name="database"
              size="sm"
              tooltip={
                queryEditorOpen
                  ? t('notebooks.panel.hide-query', 'Hide query editor')
                  : t('notebooks.panel.edit-query', 'Edit query')
              }
              aria-pressed={queryEditorOpen}
              onClick={onToggleQueryEditor}
            />
          )}
          {canEditPanel && (
            <IconButton
              name="pen"
              size="sm"
              tooltip={t('notebooks.panel.rename', 'Edit panel title')}
              onClick={() => {
                setOriginalTitle(title);
                setDraft(title);
                setRenaming(true);
              }}
            />
          )}
          {canEditPanel && (
            <VizSuggestionsButton
              cell={cell}
              panel={panel}
              lastSuggestedQuery={lastSuggestedQuery}
              autoSuggest={autoSuggest}
            />
          )}
          <PanelExploreLink panel={panel} />
          {isEditing && onDuplicate && onDelete && (
            <>
              <IconButton
                name="copy"
                size="sm"
                tooltip={t('notebook.cell.duplicate', 'Duplicate block')}
                onClick={onDuplicate}
              />
              <IconButton
                name="trash-alt"
                size="sm"
                tooltip={t('notebook.cell.delete', 'Delete block')}
                onClick={onDelete}
              />
            </>
          )}
        </Stack>
      </div>
    </>
  );
}

function PanelExploreLink({ panel }: { panel: VizPanel }) {
  const runner = getQueryRunnerFor(panel);
  if (!runner) {
    return null;
  }
  return <PanelExploreLinkWithRunner panel={panel} runner={runner} />;
}

function PanelExploreLinkWithRunner({ panel, runner }: { panel: VizPanel; runner: SceneQueryRunner }) {
  const { queries, datasource } = runner.useState();
  const { value: range } = sceneGraph.getTimeRange(panel).useState();
  const { pluginId } = panel.useState();
  const styles = useStyles2(getStyles);
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setUrl(undefined);
    if (queries.length > 0) {
      void Promise.all(
        queries.map(async (query) => {
          if (query.queryType) {
            return query;
          }
          try {
            const queryDatasource = await getDataSourceInstance(query.datasource ?? datasource);
            return queryDatasource.uid === 'grafana' ? { ...query, queryType: GrafanaQueryType.RandomWalk } : query;
          } catch {
            return query;
          }
        })
      )
        .then((exploreQueries) => tryGetExploreUrlForPanel(panel, exploreQueries))
        .then((nextUrl) => {
          if (!cancelled) {
            setUrl(nextUrl);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setUrl(undefined);
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [panel, queries, datasource, range, pluginId]);

  return url ? (
    <LinkButton
      icon="compass"
      size="sm"
      variant="secondary"
      fill="text"
      className={styles.exploreLink}
      tooltip={t('notebooks.panel.open-explore', 'Open in Explore')}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    />
  ) : null;
}

function VizSuggestionsButton({
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
  return (
    <Toggletip
      content={
        <SuggestionsContent
          cell={cell}
          panel={panel}
          lastSuggestedQuery={lastSuggestedQuery}
          autoSuggest={autoSuggest}
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
}: {
  cell: NotebookCellItem;
  panel: VizPanel;
  lastSuggestedQuery?: RefObject<DataQuery | undefined>;
  autoSuggest?: RefObject<boolean>;
}) {
  const styles = useStyles2(getStyles);
  const { data } = sceneGraph.getData(panel).useState();
  const [suggestions, setSuggestions] = useState<PanelPluginVisualizationSuggestion[]>();
  const [error, setError] = useState(false);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSuggestions(undefined);
    setError(false);
    if (data?.series.length) {
      void getAllSuggestions(data.series)
        .then((result) => {
          if (!cancelled) {
            setSuggestions(result.suggestions.slice(0, 6));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError(true);
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
  if (error) {
    return <Text color="secondary">{t('notebooks.panel.suggestions-error', 'Could not load suggestions.')}</Text>;
  }
  if (!suggestions) {
    return <Spinner />;
  }
  if (suggestions.length === 0) {
    return <Text color="secondary">{t('notebooks.panel.suggestions-empty', 'No suggestions for this data.')}</Text>;
  }

  return (
    <div className={styles.suggestions}>
      {suggestions.map((suggestion, index) => (
        <div
          key={`${suggestion.pluginId}-${index}`}
          role="button"
          tabIndex={0}
          aria-label={suggestion.name}
          onKeyDown={(event) => {
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
            void cell
              .onVisualizationChange(suggestion)
              .then(() => {
                if (lastSuggestedQuery) {
                  lastSuggestedQuery.current = selectedQuery;
                }
              })
              .catch(() => setError(true))
              .finally(() => setChanging(false));
          }}
        >
          <VisualizationSuggestionCard data={data} suggestion={suggestion} width={150} />
        </div>
      ))}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  exploreLink: css({
    border: 0,
    height: 22,
    marginLeft: theme.spacing(-0.5),
    padding: theme.spacing(0.5),
    '& svg': { margin: 0 },
  }),
  toolbar: css({
    position: 'absolute',
    right: theme.spacing(1),
    zIndex: 2,
    'button > svg[aria-hidden="true"], a > svg[aria-hidden="true"]': {
      pointerEvents: 'none',
    },
    opacity: 0,
    pointerEvents: 'none',
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create('opacity'),
    },
  }),
  toolbarEditing: css({
    top: theme.spacing(-1.5),
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(0.25, 0.5),
    paddingLeft: theme.spacing(1),
    boxShadow: theme.shadows.z1,
  }),
  toolbarViewing: css({
    top: theme.spacing(0.5),
  }),
  rename: css({
    position: 'absolute',
    top: theme.spacing(0.5),
    left: theme.spacing(1),
    zIndex: 3,
    width: 'min(320px, calc(100% - 72px))',
    background: theme.colors.background.primary,
  }),
  suggestions: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 150px)',
    gap: theme.spacing(1),
    maxHeight: 420,
    overflowY: 'auto',
    padding: theme.spacing(0.5),
  }),
});
