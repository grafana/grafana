// PROTOTYPE — throwaway. Pieces shared by every variant: rows, the header cluster, the bottom cluster.
/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { css, cx } from '@emotion/css';
import { FocusScope } from '@react-aria/focus';
import {
  type ComponentType,
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { Components } from '@grafana/e2e-selectors';
import { Icon, IconButton, Link, Tooltip, useStyles2 } from '@grafana/ui';
import { MEGA_MENU_TOGGLE_ID } from 'app/core/constants';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useHomeNav } from 'app/core/hooks/useHomeNav';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';

import { HomeLogo } from '../../Branding/Branding';
import { MegaMenuExtensionPoint } from '../MegaMenu/MegaMenuExtensionPoint';
import { OrganizationSwitcher } from '../OrganizationSwitcher/OrganizationSwitcher';

import { openDashboardsFromMenu } from './DashboardNavigator';
import { MOCK_PREFIX, type SolutionNav, getDestinations, isActiveWithin } from './solutions';
import { DASHBOARDS_SECTION_ID, canHoverOpen, openByHover, scheduleHoverClose, stickHoverOpen } from './state';

export interface SwitcherProps {
  nav: SolutionNav;
  /** Called after a solution is picked, e.g. to open the menu when picking from the top bar. */
  onPicked: () => void;
  placement: 'topbar' | 'menu';
}

export interface BodyProps {
  nav: SolutionNav;
  onNavigate: () => void;
}

export interface VariantImpl {
  Switcher: ComponentType<SwitcherProps>;
  Body: ComponentType<BodyProps>;
  /** Renders a bottom-cluster section (Connections, Administration, profile) with the variant's popout. */
  BottomSection: ComponentType<{ section: NavModelItem; nav: SolutionNav; onNavigate: () => void }>;
}

export const isMock = (item: NavModelItem) => Boolean(item.id?.startsWith(MOCK_PREFIX));

export function NavIcon({ item, size = 'md' }: { item: NavModelItem; size?: 'sm' | 'md' | 'lg' }) {
  const styles = useStyles2(getStyles);
  if (item.img) {
    return <img src={item.img} alt="" className={cx(styles.img, item.roundIcon && styles.round)} />;
  }
  return item.icon ? <Icon name={item.icon} size={size} /> : <span className={styles.iconSpacer} />;
}

export function MockBadge() {
  const styles = useStyles2(getStyles);
  return <span className={styles.mock}>mock</span>;
}

/** A navigable label: real links route, mock items do nothing. */
export function ItemLink({
  item,
  className,
  onNavigate,
  children,
}: {
  item: NavModelItem;
  className?: string;
  onNavigate: () => void;
  children: ReactNode;
}) {
  if (!item.url || isMock(item)) {
    return (
      <span className={className} title="Mock item — not navigable in the prototype">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={item.url}
      target={item.target}
      className={className}
      onClick={(e) => {
        // Choosing Dashboards opens the dashboard navigator and the most recent dashboard.
        if (item.id === DASHBOARDS_SECTION_ID) {
          e.preventDefault();
          openDashboardsFromMenu();
        }
        onNavigate();
      }}
    >
      {children}
    </Link>
  );
}

export function SectionRow({
  section,
  activeItem,
  onNavigate,
  open,
  onToggle,
  arrowHover,
  compact,
  showLabel = true,
}: {
  section: NavModelItem;
  activeItem?: NavModelItem;
  onNavigate: () => void;
  open?: boolean;
  onToggle?: (anchor: HTMLElement) => void;
  arrowHover?: ArrowHoverHandlers;
  compact?: boolean;
  showLabel?: boolean;
}) {
  const styles = useStyles2(getStyles);
  const hasDestinations = getDestinations(section).length > 0;
  const active = isActiveWithin(section, activeItem);
  return (
    <li className={cx(styles.row, compact && styles.rowCompact, active && styles.rowActive)}>
      <ItemLink item={section} onNavigate={onNavigate} className={styles.rowLink}>
        <NavIcon item={section} />
        {showLabel && <span className={styles.rowText}>{section.text}</span>}
        {showLabel && isMock(section) && <MockBadge />}
      </ItemLink>
      {hasDestinations && onToggle && (
        <IconButton
          name="angle-right"
          aria-label={`Show ${section.text} destinations`}
          aria-expanded={open}
          className={cx(styles.arrow, open && styles.arrowOpen)}
          onClick={(e) => onToggle(e.currentTarget.closest('li') ?? e.currentTarget)}
          onMouseEnter={(e) => arrowHover?.onMouseEnter(e.currentTarget.closest('li') ?? e.currentTarget)}
          onMouseLeave={arrowHover?.onMouseLeave}
        />
      )}
    </li>
  );
}

export interface ArrowHoverHandlers {
  onMouseEnter: (anchor: HTMLElement) => void;
  onMouseLeave: () => void;
}

// Hovering an arrow opens its popout after a short pause, so sweeping the pointer across other
// arrows on the way into an open popout doesn't swap it. Leaving the arrow or the popout closes it
// after a grace period long enough to cross the gap between them. A click pins it open.
const HOVER_OPEN_DELAY = 120;
const HOVER_CLOSE_DELAY = 300;

/** One open destination popout at a time, anchored to the row that opened it. */
export function usePopout() {
  const [open, setOpen] = useState<{ id: string; anchor: HTMLElement; pinned: boolean } | undefined>();
  const panelRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  anchorRef.current = open?.anchor ?? null;
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pinnedRef = useRef(false);
  pinnedRef.current = Boolean(open?.pinned);

  const clearTimers = () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
  };
  useEffect(() => clearTimers, []);

  const close = () => {
    clearTimers();
    setOpen(undefined);
  };
  const scheduleClose = () => {
    clearTimeout(openTimer.current);
    if (pinnedRef.current) {
      return;
    }
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen((cur) => (cur?.pinned ? cur : undefined)), HOVER_CLOSE_DELAY);
  };
  const keepOpen = () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
  };

  useDismiss(Boolean(open), [panelRef, anchorRef], close);

  return {
    openId: open?.id,
    anchor: open?.anchor,
    pinned: Boolean(open?.pinned),
    panelRef,
    close,
    isOpen: (s: NavModelItem) => open?.id === (s.id ?? s.text),
    toggle: (s: NavModelItem) => (anchor: HTMLElement) => {
      clearTimers();
      const id = s.id ?? s.text;
      // Clicking an arrow whose popout hover already opened pins it rather than closing it.
      setOpen((cur) => (cur?.id === id && cur.pinned ? undefined : { id, anchor, pinned: true }));
    },
    hover: (s: NavModelItem): ArrowHoverHandlers => ({
      onMouseEnter: (anchor) => {
        clearTimeout(closeTimer.current);
        clearTimeout(openTimer.current);
        const id = s.id ?? s.text;
        openTimer.current = setTimeout(
          () => setOpen((cur) => (cur?.id === id ? cur : { id, anchor, pinned: false })),
          HOVER_OPEN_DELAY
        );
      },
      onMouseLeave: scheduleClose,
    }),
    panelHoverProps: { onMouseEnter: keepOpen, onMouseLeave: scheduleClose },
  };
}

/**
 * Floating panels render in a body portal: the docked menu is its own low stacking context, so
 * panels inside it would sit under page content. The nested FocusScope lets the undocked menu's
 * contained focus scope accept focus inside the portal, and the data attribute lets the overlay
 * treat clicks in it as inside the menu.
 */
export function Floating({ children }: { children: ReactNode }) {
  return createPortal(
    <FocusScope>
      <div data-proto-floating style={{ display: 'contents' }}>
        {children}
      </div>
    </FocusScope>,
    document.body
  );
}

/** Position for a panel beside its anchor row; rows in the lower half open upwards. */
export function anchoredPosition(anchor: HTMLElement, gap = 4): CSSProperties {
  const rect = anchor.getBoundingClientRect();
  const menu = anchor.closest('[data-proto-menu]')?.getBoundingClientRect() ?? rect;
  const left = menu.right + gap;
  return rect.top > window.innerHeight / 2
    ? { left, bottom: Math.max(8, window.innerHeight - rect.bottom) }
    : { left, top: rect.top };
}

export function menuRightEdge(anchor: HTMLElement) {
  return (anchor.closest('[data-proto-menu]')?.getBoundingClientRect() ?? anchor.getBoundingClientRect()).right;
}

/** A section's destinations; destinations with their own children become headings (never a second popout). */
export function DestinationList({
  section,
  activeItem,
  onNavigate,
  columns = 1,
}: {
  section: NavModelItem;
  activeItem?: NavModelItem;
  onNavigate: () => void;
  columns?: number;
}) {
  const styles = useStyles2(getStyles);
  const destinations = getDestinations(section);
  const leaves = destinations.filter((d) => !getDestinations(d).length);
  const groups = destinations.filter((d) => getDestinations(d).length);

  const renderLeaf = (d: NavModelItem) => (
    <li key={d.id ?? d.text}>
      <ItemLink
        item={d}
        onNavigate={onNavigate}
        className={cx(styles.destination, isActiveWithin(d, activeItem) && styles.destinationActive)}
      >
        {d.text}
      </ItemLink>
    </li>
  );

  return (
    <div className={styles.destinations} style={{ columnCount: columns }}>
      {leaves.length > 0 && <ul className={styles.destinationGroup}>{leaves.map(renderLeaf)}</ul>}
      {groups.map((g) => (
        <div key={g.id ?? g.text} className={styles.destinationGroup}>
          <ItemLink item={g} onNavigate={onNavigate} className={styles.heading}>
            {g.text}
          </ItemLink>
          <ul className={styles.plainList}>{getDestinations(g).map(renderLeaf)}</ul>
        </div>
      ))}
    </div>
  );
}

/** `[dock toggle] [⊞ switcher] [logo]` — in the top bar when undocked, in the menu header when docked. */
export function HeaderCluster({
  impl,
  nav,
  placement,
}: {
  impl: VariantImpl;
  nav: SolutionNav;
  placement: 'topbar' | 'menu';
}) {
  const styles = useStyles2(getStyles);
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const homeNav = useHomeNav();
  const isXl = useMediaQueryMinWidth('xl');
  const { Switcher } = impl;

  const onDockClick = () => {
    stickHoverOpen();
    if (!isXl) {
      chrome.setMegaMenuOpen(!state.megaMenuOpen);
      return;
    }
    if (state.megaMenuDocked) {
      chrome.setMegaMenuDocked(false);
      chrome.setMegaMenuOpen(false);
    } else {
      chrome.setMegaMenuDocked(true);
      chrome.setMegaMenuOpen(true);
    }
  };

  const hoverable = placement === 'topbar' && canHoverOpen(isXl);
  const tooltip = !isXl ? 'Open menu' : state.megaMenuDocked ? 'Undock menu' : 'Hover to open, click to dock';

  return (
    <div className={styles.cluster}>
      <Tooltip content={tooltip} placement="bottom">
        <button
          type="button"
          data-proto-hover-zone
          id={placement === 'topbar' ? MEGA_MENU_TOGGLE_ID : undefined}
          data-testid={placement === 'topbar' ? Components.NavBar.Toggle.button : undefined}
          aria-label={tooltip}
          aria-expanded={state.megaMenuOpen}
          className={cx(styles.clusterButton, state.megaMenuOpen && placement === 'topbar' && styles.clusterActive)}
          onClick={onDockClick}
          onMouseEnter={hoverable ? () => openByHover(chrome) : undefined}
          onMouseLeave={hoverable ? () => scheduleHoverClose(chrome) : undefined}
        >
          <Icon name={isXl ? 'web-section-alt' : 'bars'} size="lg" />
        </button>
      </Tooltip>
      {nav.solutions.length > 1 && (
        <Switcher
          nav={nav}
          placement={placement}
          onPicked={() => {
            if (placement === 'topbar') {
              chrome.setMegaMenuOpen(true);
            }
          }}
        />
      )}
      <HomeLogo homeNav={homeNav} />
    </div>
  );
}

export function BottomCluster({
  impl,
  nav,
  onNavigate,
}: {
  impl: VariantImpl;
  nav: SolutionNav;
  onNavigate: () => void;
}) {
  const styles = useStyles2(getStyles);
  const { BottomSection } = impl;
  return (
    <div className={styles.bottom}>
      <MegaMenuExtensionPoint />
      <ul className={styles.plainList}>
        <li className={styles.row}>
          <span className={styles.rowLink} title="Customise navigation is not wired up in the prototype">
            <Icon name="sliders-v-alt" />
            <span className={styles.rowText}>Customise navigation</span>
            <MockBadge />
          </span>
        </li>
        {nav.bottom.map((s) => (
          <BottomSection key={s.id ?? s.text} section={s} nav={nav} onNavigate={onNavigate} />
        ))}
      </ul>
      <OrganizationSwitcher undocked={true} />
      {nav.profile && (
        <ul className={styles.plainList}>
          <BottomSection section={nav.profile} nav={nav} onNavigate={onNavigate} />
        </ul>
      )}
    </div>
  );
}

/** Closes a floating panel on outside mousedown and on Escape (before the menu itself sees Escape). */
export function useDismiss(open: boolean, refs: Array<RefObject<HTMLElement | null>>, onDismiss: () => void) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  useEffect(() => {
    if (!open) {
      return;
    }
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Node && refs.some((r) => r.current?.contains(target)))) {
        dismissRef.current();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        dismissRef.current();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

export const getStyles = (theme: GrafanaTheme2) => ({
  img: css({ width: theme.spacing(2), height: theme.spacing(2) }),
  round: css({ borderRadius: theme.shape.radius.circle }),
  iconSpacer: css({ display: 'inline-block', width: theme.spacing(2) }),
  mock: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.disabled,
    border: `1px dashed ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(0, 0.5),
    marginLeft: 'auto',
  }),
  row: css({
    display: 'flex',
    alignItems: 'center',
    borderRadius: theme.shape.radius.default,
    minHeight: theme.spacing(4),
    paddingRight: theme.spacing(0.5),
    '&:hover': { background: theme.colors.action.hover },
  }),
  rowCompact: css({ minHeight: theme.spacing(3.5) }),
  rowActive: css({
    background: theme.colors.action.selected,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  rowLink: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    flex: 1,
    minWidth: 0,
    padding: theme.spacing(0.5, 1),
    color: 'inherit',
  }),
  rowText: css({ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
  arrow: css({ margin: 0 }),
  arrowOpen: css({ color: theme.colors.text.primary, background: theme.colors.action.selected }),
  destinations: css({ columnGap: theme.spacing(3) }),
  destinationGroup: css({
    breakInside: 'avoid',
    listStyle: 'none',
    margin: 0,
    padding: 0,
    marginBottom: theme.spacing(1),
  }),
  plainList: css({ listStyle: 'none', margin: 0, padding: 0 }),
  destination: css({
    display: 'block',
    padding: theme.spacing(0.75, 1.5),
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    '&:hover': { background: theme.colors.action.hover, color: theme.colors.text.primary },
  }),
  destinationActive: css({ color: theme.colors.text.primary, background: theme.colors.action.selected }),
  heading: css({
    display: 'block',
    padding: theme.spacing(1, 1.5, 0.5),
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  }),
  cluster: css({ display: 'flex', alignItems: 'center', gap: theme.spacing(0.5) }),
  clusterButton: css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: theme.spacing(4),
    height: theme.spacing(4),
    border: 'none',
    borderRadius: theme.shape.radius.default,
    background: 'transparent',
    color: theme.colors.text.secondary,
    '&:hover': { background: theme.colors.action.hover, color: theme.colors.text.primary },
  }),
  clusterActive: css({ background: theme.colors.action.selected, color: theme.colors.text.primary }),
  bottom: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1),
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
});
