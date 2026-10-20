import { css } from '@emotion/css';
import { useCallback, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneObjectBase, type SceneComponentProps, VizPanel } from '@grafana/scenes';
import { Button, IconButton, Input, useStyles2 } from '@grafana/ui';
import { isLibraryPanel } from 'app/features/dashboard-scene/utils/utils';

import { type NotebookCellItem } from './NotebookCellItem';
import { isNotebookCell } from './isNotebookCell';

export class NotebookPanelTitle extends SceneObjectBase {
  public static Component = ({ model }: SceneComponentProps<NotebookPanelTitle>) => {
    const panel = model.parent;
    if (!(panel instanceof VizPanel)) {
      return null;
    }
    const cell = panel.parent;
    if (!isNotebookCell(cell)) {
      return null;
    }
    return <PanelTitleEditor cell={cell} panel={panel} isEditing={true} />;
  };
}

export function PanelTitleEditor({
  cell,
  panel,
  isEditing,
}: {
  cell: NotebookCellItem;
  panel: VizPanel;
  isEditing: boolean;
}) {
  const styles = useStyles2(getStyles);
  const { title } = panel.useState();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(title);
  const [originalTitle, setOriginalTitle] = useState(title);
  const renameFinished = useRef(false);
  const startRename = useCallback(() => {
    renameFinished.current = false;
    setOriginalTitle(panel.state.title);
    setDraft(panel.state.title);
    setRenaming(true);
  }, [panel]);
  const finishRename = () => {
    if (renameFinished.current) {
      return;
    }
    renameFinished.current = true;
    cell.onPanelTitleChange(draft.trim());
    cell.onPanelTitleCommit();
    setRenaming(false);
  };

  if (!isEditing || isLibraryPanel(panel)) {
    return null;
  }
  return (
    <>
      {!renaming &&
        (title ? (
          <IconButton
            name="pen"
            size="sm"
            className={styles.titleEdit}
            data-notebook-title-action
            tooltip={t('notebooks.panel.rename', 'Edit panel title')}
            onClick={startRename}
          />
        ) : (
          <Button variant="secondary" fill="text" size="sm" onClick={startRename}>
            {t('notebooks.panel.add-title', 'Add title')}
          </Button>
        ))}
      {renaming && <span className={styles.renamePlaceholder} aria-hidden />}
      {renaming && (
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
                renameFinished.current = true;
                cell.onPanelTitleChange(originalTitle);
                cell.onPanelTitleCommit();
                setRenaming(false);
              }
            }}
          />
        </div>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  titleEdit: css({
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
  rename: css({
    position: 'absolute',
    top: theme.spacing(0.5),
    left: theme.spacing(1),
    zIndex: 3,
    width: 'min(320px, calc(100% - 72px))',
    background: theme.colors.background.primary,
  }),
  renamePlaceholder: css({
    height: theme.spacing(3),
    width: 0,
  }),
});
