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
 *
 * It floats above the cell rather than sitting in the flow so that revealing it never moves the document,
 * which is the same reason the drag handle and the drop line are positioned.
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
    // Above the cell's own top edge, so it overlaps whatever sits above rather than displacing the cell.
    // The cell keeps its position whether the bar is showing or not.
    bottom: '100%',
    left: 0,
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5),
    backgroundColor: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z2,
    // The hidden state lives here, as it does for every other affordance: the frame's rule only ever
    // reveals. See NOTEBOOK_CELL_AFFORDANCES_CLASS.
    opacity: 0,
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create('opacity'),
    },
  }),
});
