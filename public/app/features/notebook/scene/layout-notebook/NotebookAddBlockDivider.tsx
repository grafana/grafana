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
  /**
   * Not wired up yet. Edit mode owns cell insertion, so until it passes a handler the menu is inert
   * by construction rather than by a scattering of empty click handlers.
   */
  onAdd?: (type: NotebookBlockType, index: number) => void;
  /**
   * Stable class name the parent cell frame's hover rule targets. Carries no styles of its own — the
   * hidden state stays in `styles.divider`.
   */
  className?: string;
}

/**
 * An insertion point between two notebook cells, shown only in edit mode: a hairline that reveals an
 * "Add block" button on hover, opening the block-type menu. The hover target is the full-width strip
 * rather than the button, because a button-sized target on a hidden strip is close to impossible to hit.
 */
export function NotebookAddBlockDivider({ index, onAdd, className }: Props) {
  const styles = useStyles2(getStyles);
  // The menu is portalled and FloatingFocusManager moves focus into it, so neither :hover nor
  // :focus-within holds while it is open — without this the divider fades out from under the menu it
  // just opened.
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
  // The strip reserves its height whether revealed or not: it stands in for the list's gap (see
  // NotebookLayoutManagerRenderer), so revealing a divider never shifts the cells around it. Its
  // height comes from the button plus the padding rather than a fixed value, so it follows the
  // button's size — the padding is what separates the hairline from the cells above and below.
  //
  // The hidden state lives here and nowhere else. The parent cell frame only ever reveals
  // (opacity: 1), never hides: a hide rule up there would be a two-class selector and would beat
  // `revealed` below, fading the divider out from under its own open menu.
  divider: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(2, 0),
    opacity: 0,
    // Opacity, not visibility/display: the button stays focusable, so :focus-within reveals the
    // divider for keyboard users too.
    '&:hover, &:focus-within': {
      opacity: 1,
    },
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create('opacity'),
    },
  }),
  // Same specificity as `divider`, so this only wins because emotion inserts it second. Keep it
  // declared after `divider` in this object.
  revealed: css({
    opacity: 1,
  }),
  // Button has no radius prop, and its own default radius is applied before the className, so this
  // overrides it on insertion order.
  button: css({
    borderRadius: theme.shape.radius.pill,
  }),
  line: css({
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border.weak,
  }),
});
