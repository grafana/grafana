import { css } from '@emotion/css';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAsync, useAsyncFn } from 'react-use';

import { createAssistantContextItem, OpenAssistantButton, useAssistant } from '@grafana/assistant';
import { type GrafanaTheme2, type PanelPluginVisualizationSuggestion } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { Alert, Dropdown, IconButton, LinkButton, Tooltip, useStyles2 } from '@grafana/ui';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/getQueryRunnerFor';
import { tryGetExploreUrlForPanel } from 'app/features/dashboard-scene/utils/urlBuilders';

import { NOTEBOOK_EDIT_KIND } from '../NotebookEditHistory';
import { isNotebookScene } from '../isNotebookScene';

import { type NotebookCellItem } from './NotebookCellItem';
import { NotebookVizSuggestions } from './NotebookVizSuggestions';
import { PanelQueryEditor } from './PanelQueryEditor';
import { NotebookCellTimeRangeControl } from './edit/NotebookCellTimeRangeControl';

interface Props {
  cell: NotebookCellItem;
  panel: VizPanel;
  autoFocus?: boolean;
  isEditing?: boolean;
  children: ReactNode;
}

export function NotebookPanelEditor({ cell, panel, autoFocus, children, isEditing = true }: Props) {
  const styles = useStyles2(getStyles);
  const editorId = useId();
  const runner = getQueryRunnerFor(panel);
  const { queries, datasource } = runner?.useState() ?? {};
  const { value: timeRange } = sceneGraph.getTimeRange(panel).useState();
  const { value: exploreUrl } = useAsync(
    () => tryGetExploreUrlForPanel(panel),
    // The URL helper reads these values from scene state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [panel, queries, datasource, timeRange]
  );
  const [titleTarget, setTitleTarget] = useState<HTMLSpanElement | null>(null);
  const [headerTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null);
  // Use the native panel header so its title, status, and menu keep their normal behavior.
  // The portal keeps these controls in the editor's React context without storing callbacks in scene state.
  useEffect(() => {
    const previous = panel.state.headerActions;
    const previousTitleItems = panel.state.titleItems;
    panel.setState({ headerActions: <div ref={setHeaderTarget} />, titleItems: <span ref={setTitleTarget} /> });
    return () => panel.setState({ headerActions: previous, titleItems: previousTitleItems });
  }, [panel]);
  const { isAvailable: assistantAvailable } = useAssistant();
  const [queriesOpen, setQueriesOpen] = useState(Boolean(autoFocus));
  const [editorMounted, setEditorMounted] = useState(Boolean(autoFocus));
  const { title } = panel.useState();
  let notebook = cell.parent;
  while (notebook && !isNotebookScene(notebook)) {
    notebook = notebook.parent;
  }
  const scene = notebook && isNotebookScene(notebook) ? notebook : undefined;
  const [changeState, changeVisualization] = useAsyncFn(
    async (suggestion: PanelPluginVisualizationSuggestion) => {
      cell.getParentLayout().commitPendingEdits();
      scene?.commitTitleEdit();
      // Load and migrate on a clone so the asynchronous plugin import cannot partially update the chart.
      const next = panel.clone();
      next.setState({ headerActions: undefined, titleItems: undefined });
      await next.changePluginType(suggestion.pluginId, suggestion.options, suggestion.fieldConfig);
      const action = {
        label: t('notebook.cell.visualization.change', 'Change visualization'),
        kind: NOTEBOOK_EDIT_KIND.EDIT,
        perform: () => cell.setElementBody(next),
        undo: () => cell.setElementBody(panel),
      };
      if (scene) {
        scene.editHistory.execute(action);
      } else {
        action.perform();
      }
    },
    [cell, panel, scene]
  );

  const toggleQueries = () => {
    setEditorMounted(true);
    setQueriesOpen(!queriesOpen);
  };

  return (
    <div className={styles.block}>
      {titleTarget && createPortal(<NotebookCellTimeRangeControl cell={cell} />, titleTarget)}
      {headerTarget &&
        createPortal(
          <div className={styles.toolbar}>
            {isEditing && (
              <>
                {assistantAvailable ? (
                  <OpenAssistantButton
                    iconOnlyButton
                    size="md"
                    title={t('notebook.cell.visualization.edit-with-ai', 'Edit with AI')}
                    origin="grafana/notebook/visualization-edit"
                    autoSend={false}
                    prompt={`Help me edit the visualization "${title || cell.state.elementName}" in this notebook. `}
                    context={[
                      createAssistantContextItem('structured', {
                        title: title || cell.state.elementName,
                        data: {
                          notebookUid: scene?.state.uid,
                          elementName: cell.state.elementName,
                          panelKey: panel.state.key,
                        },
                      }),
                    ]}
                  />
                ) : (
                  <Tooltip
                    content={t(
                      'notebook.cell.visualization.ai-unavailable',
                      'Grafana Assistant is not available on this instance'
                    )}
                  >
                    <span>
                      <IconButton
                        name="ai-sparkle"
                        size="md"
                        disabled
                        aria-label={t('notebook.cell.visualization.edit-with-ai', 'Edit with AI')}
                      />
                    </span>
                  </Tooltip>
                )}
              </>
            )}
            {isEditing && (
              <>
                <Dropdown
                  placement="bottom-end"
                  overlay={
                    <div className={styles.suggestions}>
                      <NotebookVizSuggestions panel={panel} onSelect={changeVisualization} />
                    </div>
                  }
                >
                  <IconButton
                    tooltip={t('notebook.cell.visualization.change', 'Change visualization')}
                    name="chart-line"
                    size="md"
                    disabled={changeState.loading}
                  />
                </Dropdown>
                <IconButton
                  tooltip={t('notebook.cell.query.disclosure', 'Query')}
                  name="arrow"
                  size="md"
                  aria-expanded={queriesOpen}
                  aria-pressed={queriesOpen}
                  aria-controls={editorId}
                  onClick={toggleQueries}
                />
              </>
            )}
            {exploreUrl && (
              <Tooltip content={t('notebook.query.open-explore', 'Open in Explore')}>
                <LinkButton
                  aria-label={t('notebook.query.open-explore', 'Open in Explore')}
                  href={exploreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  icon="compass"
                  variant="secondary"
                  fill="text"
                  size="sm"
                />
              </Tooltip>
            )}
          </div>,
          headerTarget
        )}
      {changeState.error && (
        <Alert severity="error" title={t('notebook.cell.visualization.error', 'Could not change visualization')}>
          {changeState.error.message}
        </Alert>
      )}
      {children}
      {isEditing && (
        <div className={styles.querySection} id={editorId} hidden={!queriesOpen}>
          {editorMounted && (
            <PanelQueryEditor cell={cell} panel={panel} autoFocus={true} suggestVisualization={false} />
          )}
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  block: css({
    containerType: 'inline-size',
    containerName: 'notebook-chart',
    // Flatten only this chart's chrome; the surrounding notebook already provides a surface.
    '& section[data-testid^="data-testid Panel header"]': {
      background: 'transparent',
      borderColor: 'transparent',
    },
  }),
  suggestions: css({
    padding: theme.spacing(2),
    background: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
  }),
  toolbar: css({
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  }),
  querySection: css({
    borderTop: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(2),
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
  }),
});
