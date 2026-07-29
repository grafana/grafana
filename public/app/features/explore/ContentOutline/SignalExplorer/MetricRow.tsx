import { css } from '@emotion/css';
import { memo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, useStyles2 } from '@grafana/ui';

interface Props {
  name: string;
  expanded: boolean;
  /**
   * `id` of the block this row expands, so assistive technology can follow `aria-expanded` to the
   * thing that actually appeared. The list owns it because the block is this row's sibling, not its
   * child.
   */
  labelsId: string;
  /**
   * Takes the name rather than closing over it, so the list can hoist one stable callback out of its
   * map and let the `memo` below do its job.
   */
  onToggle: (name: string) => void;
}

// Memoized: the list re-renders on every keystroke and every expansion, and only the one or two rows
// whose own props moved need to re-render with it.
export const MetricRow = memo(function MetricRow({ name, expanded, labelsId, onToggle }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <button
      type="button"
      className={styles.row}
      title={name}
      aria-expanded={expanded}
      // Only while expanded: a collapsed row's block is unmounted, and pointing at an id that is not
      // in the document is worse than saying nothing.
      aria-controls={expanded ? labelsId : undefined}
      aria-label={
        expanded
          ? t('explore.metrics-list.collapse-metric', 'Collapse {{name}}', { name })
          : t('explore.metrics-list.expand-metric', 'Expand {{name}}', { name })
      }
      onClick={() => onToggle(name)}
    >
      <Icon name={expanded ? 'angle-down' : 'angle-right'} className={styles.chevron} />
      <span className={styles.name}>{name}</span>
    </button>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  // The whole row is the control, not just the chevron: it is a bigger pointer target and one
  // tab stop per metric instead of two.
  row: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    width: '100%',
    padding: theme.spacing(0.5, 0.5),
    borderRadius: theme.shape.radius.default,
    background: 'none',
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.colors.background.secondary,
      '& span': {
        color: theme.colors.text.primary,
      },
    },
  }),
  chevron: css({
    flexShrink: 0,
    color: theme.colors.text.secondary,
  }),
  name: css({
    minWidth: 0,
    overflow: 'hidden',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontFamily: theme.typography.fontFamilyMonospace,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
});
