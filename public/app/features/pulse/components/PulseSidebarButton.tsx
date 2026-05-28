import { css } from '@emotion/css';

import { type GrafanaTheme2, locale } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Sidebar, useStyles2 } from '@grafana/ui';

import { useGetResourceUnreadCountQuery } from '../api/pulseApi';
import { useResourcePulseStream } from '../hooks/useResourcePulseStream';

interface PulseSidebarButtonProps {
  /**
   * Dashboard UID this button is attached to. When undefined (e.g.
   * the dashboard hasn't saved yet) the badge is suppressed because
   * there's no resource to read activity from yet — the button still
   * renders so the user can open the Pulse drawer, but the count is
   * permanently zero on an unsaved dashboard.
   */
  resourceUID: string | undefined;
  onClick: () => void;
}

/**
 * Hard cap on the rendered badge value. Anything past 99 collapses
 * to "99+" so the bubble never grows wider than the sidebar
 * icon and the visual stays consistent across locales. We still
 * fetch the exact count so a tooltip can surface the precise
 * value if/when one is added.
 */
const MAX_DISPLAY = 99;

/**
 * PulseSidebarButton is the dashboard sidebar's entry into the Pulse
 * drawer with a numeric unread-count badge overlaid in the top-right
 * corner. The badge keeps up with cross-tab activity via the
 * resource-scoped live channel (`useResourcePulseStream`); the same
 * live channel also drives the per-thread cache on the drawer, so
 * mounting one subscriber on every dashboard page is cheap — the
 * Live runtime dedupes channel subscriptions for us.
 *
 * Lives in the Pulse feature folder rather than in
 * dashboard-scene/edit-pane because the badge is a Pulse concern
 * (the count math, the live channel subscription, the RTK Query
 * tag wiring); the dashboard scene only needs to compose it into
 * the sidebar.
 */
export function PulseSidebarButton({ resourceUID, onClick }: PulseSidebarButtonProps) {
  const styles = useStyles2(getStyles);

  // Skip the request entirely when there's no resource UID — saves a
  // 404 round-trip on brand-new (unsaved) dashboards and avoids RTK
  // caching a permanent zero under an empty cache key.
  const { data } = useGetResourceUnreadCountQuery(
    { resourceKind: 'dashboard', resourceUID: resourceUID ?? '' },
    { skip: !resourceUID }
  );

  // Subscribe to the per-resource live channel so the badge updates
  // immediately when other users post on this dashboard. The
  // `enabled` flag mirrors the drawer's subscription contract, so
  // mounting the badge on a save-less dashboard is a no-op.
  useResourcePulseStream({ resourceKind: 'dashboard', resourceUID, enabled: !!resourceUID });

  const count = data?.unreadCount ?? 0;
  const showBadge = count > 0;
  const displayValue =
    count > MAX_DISPLAY
      ? t('pulse.sidebar.unread-badge.overflow', '{{max}}+', { max: locale(MAX_DISPLAY, 0).text })
      : locale(count, 0).text;
  // Screen-reader label is read in addition to the button's own
  // "Open Pulse" tooltip, so we phrase it as a sentence — listing
  // the precise (non-capped) count keeps the announcement honest
  // even when the visual displays "99+".
  const ariaLabel = showBadge
    ? t('pulse.sidebar.unread-badge.aria', '{{count}} unread Pulse threads on this dashboard', { count })
    : undefined;

  return (
    <div className={styles.wrapper}>
      <Sidebar.Button
        icon="comment-alt"
        onClick={onClick}
        title={t('dashboard.sidebar.pulse.title', 'Pulse')}
        tooltip={t('dashboard.sidebar.pulse.tooltip', 'Open Pulse')}
        data-testid="pulse-sidebar-button"
      />
      {showBadge && (
        <span className={styles.badge} aria-label={ariaLabel} data-testid="pulse-sidebar-unread-badge">
          {displayValue}
        </span>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    position: 'relative',
    display: 'inline-flex',
    width: '100%',
  }),
  badge: css({
    position: 'absolute',
    // Tucked against the top-right of the icon wrapper inside
    // SidebarButton so the bubble sits over the comment glyph rather
    // than the (taller) label area. The exact offsets are tuned to
    // the icon padding inside SidebarButton; they're cheap to keep
    // accurate because the sidebar icon size is locked.
    top: theme.spacing(0.25),
    right: theme.spacing(1),
    minWidth: theme.spacing(2),
    height: theme.spacing(2),
    padding: theme.spacing(0, 0.5),
    borderRadius: theme.spacing(1),
    backgroundColor: theme.colors.error.main,
    color: theme.colors.error.contrastText,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.fontWeightBold,
    lineHeight: theme.spacing(2),
    textAlign: 'center',
    pointerEvents: 'none',
    // Keep the bubble crisp on top of the icon's hover/focus
    // background so it doesn't blend in when the button is active.
    boxShadow: `0 0 0 2px ${theme.colors.background.primary}`,
  }),
});
