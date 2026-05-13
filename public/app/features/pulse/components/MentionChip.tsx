import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { type PulseMention } from '../types';

interface Props {
  mention: PulseMention;
  /** Click handler for panel mentions only — applies a panel filter in
   *  the dashboard drawer. Resource mentions (dashboard/folder) are
   *  rendered as anchor tags and ignore this prop. */
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
 * MentionChip renders a `@user`, `#panel`, `#dashboard`, or `#folder`
 * chip. Resource chips (dashboard, folder) are anchor tags that
 * navigate to the underlying entity; panel chips are buttons that
 * apply a panel filter in the current dashboard's Pulse drawer; user
 * chips are static spans.
 *
 * Security: chips render via React data bindings (no inner HTML); the
 * displayName / target id are server-validated before persistence; the
 * anchor `href` is constructed by us, never read from user input, so
 * there's no XSS surface even if a malicious displayName slipped
 * through.
 */
export function MentionChip({ mention, onClick, panelTitlesById }: Props): ReactNode {
  const styles = useStyles2(getStyles);

  // Prefer the live panel title for panel mentions so a renamed panel
  // doesn't leave its historical label stranded across every pulse
  // that referenced it. Stored displayName is the fallback for users,
  // for deleted panels (id no longer on the dashboard), and for
  // resource chips whose live title we don't have on this surface.
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

  if (mention.kind === 'dashboard' || mention.kind === 'folder') {
    // Resource chips link to the underlying entity. Using a real
    // anchor (rather than a router push) lets cmd/ctrl-click open a
    // new tab, matches the affordance of the resource link in the
    // overview table, and keeps the chip keyboard-navigable. The
    // label is wrapped in a span so the chip can take a pill-shaped
    // style without the linter flagging a bare anchor — and the span
    // makes the chip text easier to truncate / style further if we
    // ever want to (e.g. dimmed prefix, bolded title).
    const href = resourceHref(mention.kind, mention.targetId);
    return (
      <a className={styles.resource} href={href}>
        <span>#{label}</span>
      </a>
    );
  }

  if (mention.kind === 'panel') {
    if (onClick) {
      return (
        <button type="button" className={styles.panel} onClick={() => onClick(mention)}>
          #{label}
        </button>
      );
    }
    return <span className={styles.panel}>#{label}</span>;
  }

  return <span className={styles.user}>@{label}</span>;
}

/**
 * resourceHref returns the canonical link for a resource mention.
 * Folder UIDs route to the browse-dashboards folder page; dashboard
 * UIDs route to the dashboard view. Both shapes match what
 * `buildThreadHref` already produces on the Pulse overview, so the
 * link target inside a chip is identical to the link in the row
 * above it.
 */
function resourceHref(kind: 'dashboard' | 'folder', uid: string): string {
  const encoded = encodeURIComponent(uid);
  return kind === 'dashboard' ? `/d/${encoded}` : `/dashboards/f/${encoded}`;
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
  // Resource chips (dashboard, folder) use the success palette so
  // they read as a navigable link in flowing prose while staying
  // visually distinct from panel chips (warning) and user chips
  // (primary). The hover underline matches the panel chip so all
  // clickable mentions share the same feedback cue.
  resource: css({
    display: 'inline-block',
    padding: '0 6px',
    margin: '0 2px',
    borderRadius: theme.shape.radius.pill,
    background: theme.colors.success.transparent,
    color: theme.colors.success.text,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
      color: theme.colors.success.text,
    },
  }),
});
