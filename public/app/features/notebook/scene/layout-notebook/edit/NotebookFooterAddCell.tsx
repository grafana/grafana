import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';

import { getNotebookBlockTypeOptions, type NotebookBlockType } from './NotebookBlockTypeMenu';

interface Props {
  onAdd: (type: NotebookBlockType) => void;
}

/**
 * Always-visible row of add-block buttons at the bottom of the notebook, unlike the per-cell add button:
 * no hover-reveal, no dropdown — each button is already a single fixed type.
 */
export function NotebookFooterAddCell({ onAdd }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.footer}>
      {getNotebookBlockTypeOptions().map((option) => (
        <Button key={option.type} variant="secondary" size="sm" icon={option.icon} onClick={() => onAdd(option.type)}>
          {option.label}
        </Button>
      ))}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  footer: css({
    display: 'flex',
    gap: theme.spacing(1),
    padding: theme.spacing(2, 0),
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
});
