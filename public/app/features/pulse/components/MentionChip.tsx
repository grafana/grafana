import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { type PulseMention } from '../types';
import { parseTimeMentionTarget, timeChipHref } from '../utils/body';

interface Props {
  mention: PulseMention;
  /** Click handler for panel mentions only — applies a panel filter in
   *  the dashboard drawer. Resource mentions (dashboard) are rendered
   *  as anchor tags and ignore this prop. */
  onClick?: (mention: PulseMention) => void;
  /**
   * Live panel-id → title map for the dashboard the chip is rendered
   * inside. When the mention's panel has been renamed since the chip
   * was authored, we prefer the current title so the chip stays in
   * sync with the dashboard. Pass undefined (or omit) on AST-only
   * surfaces that don't know about the dashboard's panels.
   */
  panelTitlesById?: ReadonlyMap<number, string>;
  /**
   * UID of the dashboard a `time` chip should navigate to when
   * clicked. Required for time chips to be navigable; omit on
   * surfaces with no dashboard target and the chip falls back to a
   * static label.
   */
  dashboardUID?: string;
  /**
   * Optional in-place click handler for `time` chips. When set, a
   * plain left-click on the chip preventsDefault on the wrapping
   * anchor and routes through this callback instead — used by the
   * dashboard drawer to update the SceneTimeRange without a page
   * navigation. The anchor's `href` is preserved either way so
   * cmd/ctrl-click still opens the time-pinned URL in a new tab.
   */
  onTimeChipClick?: (from: number, to: number) => void;
}

/**
 * MentionChip renders a `@user`, `#panel`, or `#dashboard` chip.
 * Dashboard chips are anchor tags that navigate to the underlying
 * dashboard; panel chips are buttons that apply a panel filter in
 * the current dashboard's Pulse drawer; user chips are static spans.
 *
 * Legacy folder chips persisted in old bodies (folder mentions were
 * dropped together with folder-as-a-resource) fall through to the
 * static text fallback at the bottom of the function so they still
 * render readably without exposing a broken navigable link.
 *
 * Security: chips render via React data bindings (no inner HTML); the
 * displayName / target id are server-validated before persistence; the
 * anchor `href` is constructed by us, never read from user input, so
 * there's no XSS surface even if a malicious displayName slipped
 * through.
 */
export function MentionChip({ mention, onClick, panelTitlesById, dashboardUID, onTimeChipClick }: Props): ReactNode {
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

  if (mention.kind === 'dashboard') {
    // Dashboard chips link to the dashboard. Using a real anchor
    // (rather than a router push) lets cmd/ctrl-click open a new
    // tab, matches the affordance of the resource link in the
    // overview table, and keeps the chip keyboard-navigable. The
    // label is wrapped in a span so the chip can take a pill-shaped
    // style without the linter flagging a bare anchor.
    const href = `/d/${encodeURIComponent(mention.targetId)}`;
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

  if (mention.kind === 'user') {
    return <span className={styles.user}>@{label}</span>;
  }

  // Webhook chips are stylized like user mentions (same `@` prefix and
  // primary palette) per the product ask — a mentioned hook reads as
  // "this participant", just one that happens to be an automation. The
  // chip stays inert: clicking a hook has no user-facing navigation,
  // its only job is to fire the outbound webhook on save.
  if (mention.kind === 'webhook') {
    return <span className={styles.user}>@{label}</span>;
  }

  if (mention.kind === 'time') {
    // Time chips need a dashboard target and a well-formed range to
    // be navigable. If either is missing, fall back to a static
    // label so a chip with a corrupt TargetID can't render a broken
    // link. The href is built by us (encoded UID + integer ms), so
    // there's no XSS surface even if the displayName were hostile.
    const range = parseTimeMentionTarget(mention.targetId);
    if (dashboardUID && range) {
      const handleClick = onTimeChipClick
        ? (e: React.MouseEvent<HTMLAnchorElement>) => {
            // Modifier-key clicks must still hit the anchor's
            // default so users can open the time-pinned URL in a
            // new tab (cmd-click, ctrl-click) or window (shift).
            // Plain left-click routes to the in-place handler.
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
              return;
            }
            e.preventDefault();
            onTimeChipClick(range.from, range.to);
          }
        : undefined;
      return (
        <a className={styles.time} href={timeChipHref(dashboardUID, range.from, range.to)} onClick={handleClick}>
          <span>@{label}</span>
        </a>
      );
    }
    return <span className={styles.time}>@{label}</span>;
  }

  // Defensive fallback: any other kind (e.g. legacy `folder` chips
  // still in old bodies) renders as a plain text span so the
  // surrounding sentence still reads, with no broken link target.
  return <span className={styles.legacy}>#{label}</span>;
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
  // Resource chips (dashboard) use the success palette so they read
  // as a navigable link in flowing prose while staying visually
  // distinct from panel chips (warning) and user chips (primary).
  // The hover underline matches the panel chip so all clickable
  // mentions share the same feedback cue.
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
  // Time chips read as "this conversation pinned the dashboard at
  // <range>". Visually distinct from user/panel/resource chips so a
  // reader can scan a thread and tell at a glance which chips are
  // temporal anchors. The hover underline matches the dashboard chip
  // because both are navigable links — clicking a time chip jumps
  // the dashboard to the chip's frozen `from`/`to` window.
  time: css({
    display: 'inline-block',
    padding: '0 6px',
    margin: '0 2px',
    borderRadius: theme.shape.radius.pill,
    background: theme.colors.info.transparent,
    color: theme.colors.info.text,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
      color: theme.colors.info.text,
    },
  }),
  // Inert fallback for legacy / unknown mention kinds — looks like
  // a chip so the surrounding text doesn't reflow, but doesn't
  // pretend to be navigable.
  legacy: css({
    display: 'inline-block',
    padding: '0 6px',
    margin: '0 2px',
    borderRadius: theme.shape.radius.pill,
    background: theme.colors.background.secondary,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    whiteSpace: 'nowrap',
  }),
});
