import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Dropdown, useStyles2 } from '@grafana/ui';

import { NotebookBlockTypeMenu, type NotebookBlockType } from './NotebookBlockTypeMenu';

interface Props {
  /**
   * Where a pick would insert. Always `cells.length` — this prompt appends. The parent owns the index
   * rather than the prompt deriving it, so both add-block affordances take it the same way.
   */
  index: number;
  /** Insertion belongs to the layout manager, exactly as on NotebookAddBlockDivider. */
  onAdd?: (type: NotebookBlockType, index: number) => void;
}

export function NotebookAddBlockPrompt({ index, onAdd }: Props) {
  const styles = useStyles2(getStyles);

  return (
    // this behaves as a button, until we get more info about the block type
    <Dropdown overlay={<NotebookBlockTypeMenu index={index} onAdd={onAdd} />} placement="bottom-start">
      <button type="button" aria-haspopup="menu" className={styles.prompt}>
        <Trans i18nKey="notebook.add-block.prompt">Type to start writing — press / for blocks</Trans>
      </button>
    </Dropdown>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  prompt: css({
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: theme.spacing(1, 0),
    background: 'none',
    border: 'none',
    borderRadius: theme.shape.radius.default,
    ...theme.typography.body,
    color: theme.colors.text.disabled,
    // It opens a menu, so it points. This becomes `text` the day it becomes a real input.
    cursor: 'pointer',
    '&:hover': {
      color: theme.colors.text.secondary,
    },
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create('color'),
    },
  }),
});
