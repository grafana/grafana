import { css, cx } from '@emotion/css';
import { type ReactNode, type Ref, type RefObject } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { IconButton, Stack, useStyles2 } from '@grafana/ui';
import { isLibraryPanel } from 'app/features/dashboard-scene/utils/utils';

import { type NotebookCellItem } from './NotebookCellItem';
import { PanelExploreLink } from './PanelExploreLink';
import { VizSuggestionsButton } from './VizSuggestionsButton';
import { NotebookCellActions } from './edit/NotebookCellActions';
import { NOTEBOOK_CELL_CONTROLS_CLASS } from './edit/cellClassNames';

interface Props {
  cell: NotebookCellItem;
  panel: VizPanel;
  isEditing: boolean;
  lastSuggestedQuery?: RefObject<DataQuery | undefined>;
  autoSuggest?: RefObject<boolean>;
  onToggleQueryEditor?: () => void;
  queryEditorOpen?: boolean;
  queryEditorId?: string;
  timeRangeControl?: ReactNode;
  onDuplicate?: () => void;
  onDelete?: () => void;
  toolbarRef?: Ref<HTMLDivElement>;
}

export function NotebookPanelActions({
  cell,
  panel,
  isEditing,
  lastSuggestedQuery,
  autoSuggest,
  onToggleQueryEditor,
  queryEditorOpen,
  queryEditorId,
  timeRangeControl,
  onDuplicate,
  onDelete,
  toolbarRef,
}: Props) {
  const styles = useStyles2(getStyles);
  const canEditPanel = isEditing && !isLibraryPanel(panel);
  return (
    <div
      ref={toolbarRef}
      className={cx(
        styles.toolbar,
        isEditing ? styles.toolbarEditing : styles.toolbarViewing,
        NOTEBOOK_CELL_CONTROLS_CLASS
      )}
      data-notebook-panel-actions
    >
      <Stack direction="row" gap={0.5} alignItems="center">
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
          <NotebookCellActions inline onDuplicate={onDuplicate} onDelete={onDelete} />
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
    '&:has(button[aria-expanded="true"]:not([aria-pressed]))': {
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
});
