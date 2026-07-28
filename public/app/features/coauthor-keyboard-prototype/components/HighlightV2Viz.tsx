import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

import { type BuildNode, type MapNode } from '../logic/highlightV2';

function Arrow() {
  const styles = useStyles2(getStyles);
  return (
    <span className={styles.arrow}>
      <span className={styles.dashes} />
      <Icon name="angle-right" size="sm" className={styles.chevron} />
    </span>
  );
}

/**
 * The non-AI query map: the whole query left to right, with the highlighted
 * section's nodes picked out from the rest.
 */
export function QueryMapFlow({ nodes }: { nodes: MapNode[] }) {
  const styles = useStyles2(getStyles);
  // Hovering a node adds its explanation as a third row, growing the node (and
  // the popover) rather than floating a tooltip over the map.
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div className={styles.row}>
      {nodes.map((n, i) => [
        <div
          key={`n${i}`}
          className={cx(
            styles.node,
            n.selected ? styles.nodeSelected : styles.nodeMuted,
            n.error && styles.nodeError,
            hovered === i && styles.nodeHovered
          )}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
        >
          <div className={cx(styles.category, n.selected && styles.categorySelected, n.error && styles.categoryError)}>
            {n.error && <Icon name="exclamation-triangle" size="xs" />} {n.category}
          </div>
          <div className={cx(styles.value, n.selected && styles.valueSelected, n.error && styles.valueError)}>
            {n.value}
          </div>
          {hovered === i && <div className={cx(styles.hint, n.error && styles.hintError)}>{n.hint}</div>}
        </div>,
        i < nodes.length - 1 ? <Arrow key={`a${i}`} /> : null,
      ])}
    </div>
  );
}

/**
 * The popover's small flow. A node with no value is still being worked out and
 * renders as an empty dashed box; `changed` marks what the suggestion edits.
 */
export function BuildFlow({ nodes }: { nodes: BuildNode[] }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.row}>
      {nodes.map((n, i) => [
        <div
          key={`n${i}`}
          className={cx(styles.node, n.changed ? styles.nodeChanged : styles.nodeMuted, !n.value && styles.nodePending)}
        >
          <div className={cx(styles.category, n.changed && styles.categorySelected)}>{n.category}</div>
          {n.value && <div className={cx(styles.value, n.changed && styles.valueSelected)}>{n.value}</div>}
        </div>,
        i < nodes.length - 1 ? <Arrow key={`a${i}`} /> : null,
      ])}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({ display: 'flex', alignItems: 'center', gap: theme.spacing(1), flexWrap: 'wrap' }),
  node: css({
    borderRadius: 6,
    padding: theme.spacing(0.75, 1),
    minWidth: 110,
    background: theme.colors.background.secondary,
  }),
  nodeMuted: css({ border: `1px dashed ${theme.colors.border.medium}` }),
  nodeSelected: css({
    border: `1px solid ${theme.colors.primary.border}`,
    background: theme.colors.background.canvas,
  }),
  nodeChanged: css({
    border: `1px dashed ${theme.colors.primary.border}`,
    background: theme.colors.background.canvas,
  }),
  nodePending: css({ minHeight: 40 }),
  nodeError: css({ border: `1px solid ${theme.colors.error.border}` }),
  nodeHovered: css({ background: theme.colors.background.primary }),
  hint: css({
    marginTop: theme.spacing(0.75),
    paddingTop: theme.spacing(0.75),
    borderTop: `1px solid ${theme.colors.border.weak}`,
    // Capped so a node grows a line or two instead of stretching the whole row.
    maxWidth: 170,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: 1.4,
  }),
  hintError: css({ color: theme.colors.error.text }),
  category: css({
    display: 'inline-block',
    fontSize: 10,
    letterSpacing: 0.5,
    color: theme.colors.text.secondary,
    background: theme.colors.background.primary,
    borderRadius: 3,
    padding: '1px 4px',
    marginBottom: 4,
  }),
  categorySelected: css({ color: theme.colors.primary.text, background: 'rgba(110, 159, 255, 0.16)' }),
  categoryError: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    color: theme.colors.error.text,
    background: 'rgba(240, 78, 152, 0.12)',
  }),
  value: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),
  valueSelected: css({ color: theme.colors.text.primary }),
  valueError: css({
    textDecorationLine: 'underline',
    textDecorationStyle: 'wavy',
    textDecorationColor: theme.colors.error.text,
    textDecorationSkipInk: 'none',
    textUnderlineOffset: 3,
  }),
  arrow: css({ display: 'inline-flex', alignItems: 'center', color: theme.colors.text.disabled }),
  dashes: css({ width: 20, borderTop: `1px dashed ${theme.colors.border.strong}`, display: 'inline-block' }),
  chevron: css({ color: theme.colors.text.disabled, marginLeft: -4 }),
});
