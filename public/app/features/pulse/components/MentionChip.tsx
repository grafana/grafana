import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { type PulseMention } from '../types';

interface Props {
  mention: PulseMention;
  onClick?: (mention: PulseMention) => void;
  /**
   * Live panel-id → title map for the dashboard the chip is rendered
   * inside. When the mention's panel has been renamed since the chip
   * was authored, we prefer the current title so the chip stays in
   * sync with the dashboard. Pass undefined (or omit) on AST-only
   * surfaces that don't know about the dashboard's panels.
   */
  panelTitlesById?: ReadonlyMap<number, string>;
}

/**
 * MentionChip renders an @user or @panel reference. Clicking a panel
 * mention is wired by the parent (typically: scroll the dashboard to
 * that panel via the existing viewPanel URL key).
 *
 * Security: mentions render via React data binding (no inner HTML), the
 * displayName is server-provided and was schema-validated before
 * persistence. Even if a malicious displayName slipped through, the
 * worst it can do is render as text.
 */
export function MentionChip({ mention, onClick, panelTitlesById }: Props): ReactNode {
  const styles = useStyles2(getStyles);
  // Prefer the live dashboard title for panel mentions so a renamed
  // panel doesn't leave its historical label stranded across every
  // pulse that referenced it. Stored displayName is the fallback for
  // user mentions and for panels that have been deleted (panel id no
  // longer on the dashboard).
  let label = mention.displayName ?? mention.targetId;
  if (mention.kind === 'panel' && panelTitlesById) {
    const id = parseInt(mention.targetId, 10);
    if (!Number.isNaN(id)) {
      const current = panelTitlesById.get(id);
      if (current) {
        label = current;
      }
    }
  }
  const isPanel = mention.kind === 'panel';
  const className = isPanel ? styles.panel : styles.user;
  const prefix = isPanel ? '#' : '@';

  if (onClick) {
    return (
      <button type="button" className={className} onClick={() => onClick(mention)}>
        {prefix}
        {label}
      </button>
    );
  }
  return (
    <span className={className}>
      {prefix}
      {label}
    </span>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  user: css({
    display: 'inline-block',
    padding: '0 6px',
    margin: '0 2px',
    borderRadius: theme.shape.radius.pill,
    background: theme.colors.primary.transparent,
    color: theme.colors.primary.text,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    border: 'none',
    cursor: 'inherit',
    whiteSpace: 'nowrap',
  }),
  panel: css({
    display: 'inline-block',
    padding: '0 6px',
    margin: '0 2px',
    borderRadius: theme.shape.radius.pill,
    background: theme.colors.warning.transparent,
    color: theme.colors.warning.text,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    '&:hover': {
      textDecoration: 'underline',
    },
  }),
});
