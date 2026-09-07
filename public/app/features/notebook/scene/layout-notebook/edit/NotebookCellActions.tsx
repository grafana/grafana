import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, useStyles2 } from '@grafana/ui';

interface Props {
  onDuplicate: () => void;
  onDelete: () => void;
  /** The frame's hover class, so these reveal with the rest of the cell's affordances. */
  className?: string;
}

/**
 * The per-cell actions, revealed with the rest of a cell's affordances on hover: a small elevated bar
 * above the cell carrying duplicate and delete.
 */
export function NotebookCellActions({ onDuplicate, onDelete, className }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.actions, className)}>
      <IconButton
        name="copy"
        size="sm"
        tooltip={t('notebook.cell.duplicate', 'Duplicate block')}
        onClick={onDuplicate}
      />
      <IconButton name="trash-alt" size="sm" tooltip={t('notebook.cell.delete', 'Delete block')} onClick={onDelete} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  actions: css({
    position: 'absolute',
    bottom: '100%',
    left: theme.spacing(4),
    [theme.breakpoints.up('md')]: {
      left: theme.spacing(7),
    },
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5),
    backgroundColor: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z2,
    opacity: 0,
    // bottom: 100% puts this outside the frame's box, on top of the previous cell's insertion divider.
    // Invisible is not enough there — it would still win the hit test and turn a click meant for
    // "Add block" into a duplicate or delete of this cell. The frame's reveal rule restores
    // pointer-events along with the opacity.
    pointerEvents: 'none',
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create('opacity'),
    },
  }),
});
