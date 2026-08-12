import { css } from '@emotion/css';
import type * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Dropdown, useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

import { NotebookBlockTypeMenu, type NotebookBlockType } from './NotebookBlockTypeMenu';

interface Props {
  /**
   * Where a pick would insert. Always `cells.length` — this prompt appends. The parent owns the index
   * rather than the prompt deriving it, so both add-block affordances take it the same way.
   */
  index: number;
  /**
   * Not wired up yet, exactly as on NotebookAddBlockDivider — edit mode owns cell insertion.
   */
  onAdd?: (type: NotebookBlockType, index: number) => void;
}

/**
 * The end of the document, as an invitation rather than a control: muted copy on the page background that
 * opens the block-type menu, on click or as soon as you type. Unlike the dividers it is always visible,
 * because an empty notebook has no cell to hover and a hover-only affordance would leave nothing on
 * screen at all.
 *
 * It appends to the same position as the last cell's divider on purpose. The overlap is the point: the
 * divider is where you look when editing between cells, this is where you look once you have reached the
 * bottom and want to keep writing.
 */
export function NotebookAddBlockPrompt({ index, onAdd }: Props) {
  const styles = useStyles2(getStyles);

  // Dropdown owns its open state and clones the trigger with floating-ui's own onKeyDown, which would
  // clobber a handler placed on the button — so listen for the bubbled event out here and turn it into
  // the click Dropdown does listen for.
  const openOnTyping = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Single-character keys are the printable ones, which is what "type to start writing" means. Enter
    // and Space already open the menu natively; Tab and the arrows have longer names and have to stay
    // available for navigation.
    if (event.key.length !== 1) {
      return;
    }

    event.preventDefault();
    // The focused element is the trigger. Dropdown owns its ref, so there is none of ours to reach for.
    if (event.target instanceof HTMLElement) {
      event.target.click();
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div onKeyDown={openOnTyping}>
      <Dropdown overlay={<NotebookBlockTypeMenu index={index} onAdd={onAdd} />} placement="bottom-start">
        {/*
          A native button rather than a Button: every Button variant carries a fill, a border or a text
          colour that reads as a control, and this row has to read as the next paragraph. Dropdown clones
          its child to attach the ref, the click handler and aria-expanded, so a bare button is a
          first-class trigger; aria-haspopup is the one thing it does not supply.
        */}
        <button type="button" aria-haspopup="menu" className={styles.prompt}>
          <Trans i18nKey="notebook.add-block.prompt">Type to start writing — press / for blocks</Trans>
        </button>
      </Dropdown>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  prompt: css({
    // Full width so the whole row is the target rather than just the glyphs, and reset to the document's
    // own typography: it has to sit in the same box as a narrative cell's content (see
    // NotebookCellRenderer) — same left edge, same line height, same vertical padding — so it reads as
    // the paragraph you are about to write and not as a control below the page.
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: theme.spacing(1, 0),
    background: 'none',
    border: 'none',
    borderRadius: theme.shape.radius.default,
    ...theme.typography.body,
    // The placeholder token, not action.disabledText: this row is clickable, and disabledText on a live
    // control tells everyone — including a contrast checker — that it is dead.
    color: theme.colors.text.disabled,
    // It opens a menu, so it points. This becomes `text` the day it becomes a real input.
    cursor: 'pointer',
    '&:hover': {
      color: theme.colors.text.secondary,
    },
    // Same pair as the command palette's trigger: no ring on click, and none when FloatingFocusManager
    // hands focus back as the menu closes — which would otherwise leave a ring on what looks like body
    // copy after every dismissal.
    '&:focus': {
      outline: 'unset',
      boxShadow: 'unset',
    },
    '&:focus-visible': getFocusStyles(theme),
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create('color'),
    },
  }),
});
