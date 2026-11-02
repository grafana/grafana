import { css, cx } from '@emotion/css';
import { type ReactNode, type Ref, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';
import { IconButton, Stack, useStyles2 } from '@grafana/ui';
import { useAddToAssistant } from 'app/core/assistant/useAddToAssistant';
import { isLibraryPanel } from 'app/features/dashboard-scene/utils/utils';

import { type NotebookCellItem } from './NotebookCellItem';
import { PanelExploreLink } from './PanelExploreLink';
import { VizSuggestionsButton } from './VizSuggestionsButton';
import { buildNotebookPanelAssistantContext } from './buildNotebookPanelAssistantContext';
import { NotebookCellActions } from './edit/NotebookCellActions';
import { NOTEBOOK_CELL_CONTROLS_CLASS, NOTEBOOK_CELL_CONTROLS_PINNED_CLASS } from './edit/cellClassNames';

interface Props {
  cell: NotebookCellItem;
  panel: VizPanel;
  isEditing: boolean;
  onToggleQueryEditor?: () => void;
  queryEditorOpen?: boolean;
  queryEditorId?: string;
  timeRangeControl?: ReactNode;
  timeRangeOpen?: boolean;
  onDuplicate?: () => void;
  onDelete?: () => void;
  toolbarRef?: Ref<HTMLDivElement>;
}

export function NotebookPanelActions({
  cell,
  panel,
  isEditing,
  onToggleQueryEditor,
  queryEditorOpen,
  queryEditorId,
  timeRangeControl,
  timeRangeOpen = false,
  onDuplicate,
  onDelete,
  toolbarRef,
}: Props) {
  const styles = useStyles2(getStyles);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const pinned = suggestionsOpen || actionsOpen || timeRangeOpen;
  const canEditPanel = isEditing && !isLibraryPanel(panel);
  const { isAvailable: assistantAvailable, addToAssistant } = useAddToAssistant({
    origin: 'grafana/notebook-panel-actions',
  });
  return (
    <div
      ref={toolbarRef}
      className={cx(
        styles.toolbar,
        isEditing ? styles.toolbarEditing : styles.toolbarViewing,
        NOTEBOOK_CELL_CONTROLS_CLASS,
        pinned && [styles.revealed, NOTEBOOK_CELL_CONTROLS_PINNED_CLASS]
      )}
      data-notebook-panel-actions
    >
      <Stack direction="row" gap={0.5} alignItems="center">
        {assistantAvailable && canEditPanel && (
          <IconButton
            name="ai-sparkle"
            size="sm"
            tooltip={t('notebooks.panel.edit-with-assistant', 'Edit with Assistant')}
            onClick={() => addToAssistant(buildNotebookPanelAssistantContext(cell, panel))}
          />
        )}
        {timeRangeControl}
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
            aria-expanded={queryEditorOpen}
            aria-controls={queryEditorId}
            onClick={onToggleQueryEditor}
          />
        )}
        {canEditPanel && <VizSuggestionsButton cell={cell} panel={panel} onOpenChange={setSuggestionsOpen} />}
        <PanelExploreLink panel={panel} />
        {isEditing && onDuplicate && onDelete && (
          <NotebookCellActions inline onDuplicate={onDuplicate} onDelete={onDelete} onOpenChange={setActionsOpen} />
        )}
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  toolbar: css({
    position: 'absolute',
    right: theme.spacing(1),
    zIndex: 2,
    'button > svg[aria-hidden="true"], a > svg[aria-hidden="true"]': {
      pointerEvents: 'none',
    },
    opacity: 0,
    pointerEvents: 'none',
    '@media (hover: none)': {
      opacity: 1,
      pointerEvents: 'auto',
    },
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create('opacity'),
    },
  }),
  toolbarEditing: css({
    top: theme.spacing(1),
  }),
  toolbarViewing: css({
    top: theme.spacing(0.5),
  }),
  revealed: css({
    opacity: 1,
    pointerEvents: 'auto',
  }),
});
