import { css, cx } from '@emotion/css';
import { memo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, useStyles2 } from '@grafana/ui';

interface Props {
  name: string;
  expanded: boolean;
  selected: boolean;
  /**
   * `id` of the block this row expands, so assistive technology can follow `aria-expanded` to the
   * thing that actually appeared. The list owns it because the block is this row's sibling, not its
   * child.
   */
  labelsId: string;
  /**
   * Takes the name rather than closing over it, so the list can hoist one stable callback out of its
   * map and let the `memo` below do its job. Same for `onSelect`.
   */
  onToggle: (name: string) => void;
  onSelect: (name: string) => void;
}

// Memoized: the list re-renders on every keystroke and every expansion, and only the one or two rows
// whose own props moved need to re-render with it.
export const MetricRow = memo(function MetricRow({ name, expanded, selected, labelsId, onToggle, onSelect }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.row, selected && styles.rowSelected)}>
      {/* Siblings, not nested: WebKit treats a button's content as presentational, so a control
          inside one is invisible to VoiceOver. */}
      <button
        type="button"
        className={styles.chevronButton}
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
        <Icon name={expanded ? 'angle-down' : 'angle-right'} />
      </button>
      <button
        type="button"
        className={styles.nameButton}
        title={name}
        // A toggle, because re-picking the open metric closes the panel.
        aria-pressed={selected}
        aria-label={t('explore.metrics-list.show-metric-details', 'Show details for {{name}}', { name })}
        onClick={() => onSelect(name)}
      >
        <span className={styles.name}>{name}</span>
      </button>
    </div>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  // Two controls, so two tab stops per metric: the chevron opens the row's labels in place, the name
  // opens the metric in the detail panel. No gap between them, or the strip would belong to neither
  // and clicking it would do nothing — their own padding sets them apart.
  row: css({
    label: 'metric-row',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    borderRadius: theme.shape.radius.default,
    '&:hover': {
      backgroundColor: theme.colors.background.secondary,
      '& span': {
        color: theme.colors.text.primary,
      },
    },
  }),
  // `&:hover` is restated because the hover rule above is more specific and would otherwise repaint
  // the selected row as merely hovered.
  rowSelected: css({
    label: 'metric-row-selected',
    '&, &:hover': {
      backgroundColor: theme.colors.action.selected,
    },
    '& span': {
      color: theme.colors.text.primary,
    },
  }),
  chevronButton: css({
    label: 'metric-row-chevron',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    padding: theme.spacing(0.5, 0, 0.5, 0.5),
    background: 'none',
    border: 'none',
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
  nameButton: css({
    label: 'metric-row-name-button',
    // Takes the rest of the row, so the pointer target is the whole line rather than just the text.
    flex: '1 1 auto',
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0.5),
    background: 'none',
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
  }),
  name: css({
    label: 'metric-row-name',
    minWidth: 0,
    overflow: 'hidden',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontFamily: theme.typography.fontFamilyMonospace,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
});
