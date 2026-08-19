import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, Dropdown, useStyles2 } from '@grafana/ui';

import { NotebookBlockTypeMenu, type NotebookBlockType } from './NotebookBlockTypeMenu';

interface Props {
  /**
   * Where this divider would insert. A divider belongs to the cell above it, so the cell at position
   * `i` owns the divider with index `i + 1`. Index 0 (above the first cell) is the one divider no cell
   * owns; the layout manager renders it standalone.
   */
  index: number;
  /** Insertion belongs to the layout manager; without a handler the menu is inert. */
  onAdd?: (type: NotebookBlockType, index: number) => void;
  /**
   * Stable class name the parent cell frame's hover rule targets. Carries no styles of its own — the
   * hidden state stays in `styles.divider`.
   */
  className?: string;
}

/**
 * An insertion point between two notebook cells, shown only in edit mode: a hairline that reveals an
 * "Add block" button on hover, opening the block-type menu.
 */
export function NotebookAddBlockDivider({ index, onAdd, className }: Props) {
  const styles = useStyles2(getStyles);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className={cx(styles.divider, className, isMenuOpen && styles.revealed)}>
      <span className={styles.line} />
      <Dropdown
        overlay={<NotebookBlockTypeMenu index={index} onAdd={onAdd} />}
        placement="bottom-start"
        onVisibleChange={setIsMenuOpen}
      >
        <Button variant="secondary" size="sm" icon="plus" className={styles.button}>
          <Trans i18nKey="notebook.add-block.label">Add block</Trans>
        </Button>
      </Dropdown>
      <span className={styles.line} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  divider: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(2, 0),
    opacity: 0,
    '&:hover, &:focus-within': {
      opacity: 1,
    },
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create('opacity'),
    },
  }),
  revealed: css({
    opacity: 1,
  }),
  button: css({
    borderRadius: theme.shape.radius.pill,
  }),
  line: css({
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border.weak,
  }),
});
