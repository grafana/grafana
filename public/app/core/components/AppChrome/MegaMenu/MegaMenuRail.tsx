import { css, cx } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2, type NavModelItem, toIconName } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { useFlagGrafanaSectionSidebar, useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { Icon, Link, ScrollContainer, Tooltip, useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useHomeNav } from 'app/core/hooks/useHomeNav';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';
import { useSyncStarredItemsInNav } from 'app/features/stars/hooks';
import { useSelector } from 'app/types/store';

import { HomeLogo } from '../../Branding/Branding';
import { type AppChromeState } from '../AppChromeService';
import { LazyFeatureControlButton } from '../FeatureControl/LazyFeatureControl';
import { HelpTopBarButton } from '../TopBar/HelpTopBarButton';
import { ProfileButton } from '../TopBar/ProfileButton';
import { getChromeHeaderLevelHeight } from '../TopBar/useChromeHeaderHeight';

import { MegaMenuCreateButton } from './MegaMenuCreateButton';
import { useNavCustomization } from './hooks';
import { getCreateActions, hasChildMatch, isRailBottomItem } from './utils';

export const MENU_RAIL_WIDTH = '48px';

/**
 * Whether the icon rail is showing. The full menu opens over it as a pullout, or docks in its
 * place, with its rows lined up with the rail's icons so it reads as the rail expanding.
 */
export function useIsMegaMenuRail(state: AppChromeState) {
  const railEnabled = useFlagGrafanaSectionSidebar();
  // A docked, open menu takes the rail's place
  return railEnabled && !state.chromeless && !(state.megaMenuDocked && state.megaMenuOpen);
}

export interface Props {
  className?: string;
}

/** The top-level sections as icons, with a toggle for the full menu */
export function MegaMenuRail({ className }: Props) {
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
  const styles = useStyles2(getStyles, visualRefreshEnabled);
  const { chrome } = useGrafana();
  const homeNav = useHomeNav();
  const { navItems, activeItem } = useNavCustomization();
  // The full menu normally fills in Starred's dashboards; the rail needs them for its flyout too
  useSyncStarredItemsInNav();
  const profileNode = useSelector((state) => state.navIndex['profile']);
  const navLabel = t('navigation.megamenu.list-label', 'Navigation');
  const renderItem = (link: NavModelItem) => {
    const isActive = link === activeItem || hasChildMatch(link, activeItem);
    return (
      <li key={link.id ?? link.text}>
        <MegaMenuRailItem link={link} isActive={isActive} activeItem={activeItem} />
      </li>
    );
  };

  return (
    <div className={cx(styles.rail, className)} data-testid={selectors.components.NavMenu.Menu}>
      <div className={styles.header}>
        <HomeLogo homeNav={homeNav} />
      </div>
      <nav className={styles.content} aria-label={navLabel}>
        <ScrollContainer height="100%" overflowX="hidden" showScrollIndicators={false}>
          <ul className={styles.list} aria-label={navLabel}>
            {navItems.filter((link) => !isRailBottomItem(link)).map(renderItem)}
          </ul>
        </ScrollContainer>
      </nav>
      <div className={styles.footer}>
        <ul className={cx(styles.list, styles.footerList)}>{navItems.filter(isRailBottomItem).map(renderItem)}</ul>
        <LazyFeatureControlButton />
        <HelpTopBarButton isSmallScreen={false} placement="right-end" />
        {profileNode && (
          <ProfileButton profileNode={profileNode} onToggleKioskMode={chrome.onToggleKioskMode} placement="right-end" />
        )}
      </div>
    </div>
  );
}

function MegaMenuRailItem({
  link,
  isActive,
  activeItem,
}: {
  link: NavModelItem;
  isActive: boolean;
  activeItem?: NavModelItem;
}) {
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
  const styles = useStyles2(getStyles, visualRefreshEnabled);
  const url = link.url ?? link.children?.find((child) => child.url)?.url;
  const isLargeScreen = useMediaQueryMinWidth('md');
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  // The create menu renders outside the flyout, so hovering it would otherwise close the flyout under it
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  // A tapped-open flyout closes when tapping anywhere outside it or its icon
  useEffect(() => {
    if (!flyoutOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (
        !target?.closest('[data-rail-flyout]') &&
        !target?.closest(`[data-rail-item="${CSS.escape(link.id ?? link.text)}"]`)
      ) {
        setFlyoutOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [flyoutOpen, link.id, link.text]);

  let icon = <Icon className={styles.icon} name="apps" size="xl" />;
  if (link.icon) {
    icon = <Icon className={styles.icon} name={toIconName(link.icon) ?? 'link'} size="xl" />;
  } else if (link.img) {
    icon = <img className={styles.img} src={link.img} alt="" />;
  }

  if (!url) {
    return null;
  }

  const children = getFlyoutChildren(link);
  const hasFlyout = children.length > 0 || getCreateActions(link.children).length > 0;
  // Touch screens can't hover, so a tap opens the flyout instead of navigating
  const tapOpensFlyout = hasFlyout && !isLargeScreen;
  const itemId = link.id ?? link.text;

  return (
    <Tooltip
      content={
        hasFlyout ? (
          <MegaMenuRailFlyout
            link={link}
            items={children}
            activeItem={activeItem}
            onNavigate={() => setFlyoutOpen(false)}
            onCreateMenuOpenChange={setCreateMenuOpen}
          />
        ) : (
          link.text
        )
      }
      placement="right-start"
      interactive={hasFlyout}
      show={createMenuOpen || (tapOpensFlyout ? flyoutOpen : undefined)}
    >
      <Link
        href={url}
        className={cx(styles.item, isActive && styles.itemActive)}
        aria-label={link.text}
        aria-current={isActive ? 'page' : undefined}
        aria-expanded={tapOpensFlyout ? flyoutOpen : undefined}
        data-rail-item={itemId}
        onClick={
          tapOpensFlyout
            ? (event) => {
                event.preventDefault();
                setFlyoutOpen(!flyoutOpen);
              }
            : undefined
        }
      >
        {icon}
      </Link>
    </Tooltip>
  );
}

/** The section's pages, shown on hover so they are reachable without opening the full menu */
function MegaMenuRailFlyout({
  link,
  items,
  activeItem,
  onNavigate,
  onCreateMenuOpenChange,
}: {
  link: NavModelItem;
  items: NavModelItem[];
  activeItem?: NavModelItem;
  onCreateMenuOpenChange: (open: boolean) => void;
  /** Closes a tapped-open flyout once one of its links navigates */
  onNavigate: () => void;
}) {
  const styles = useStyles2(getFlyoutStyles);
  // The current page, or the page whose sub-pages the user is on, e.g. a playlist's edit page
  const isCurrent = (item: NavModelItem) => item === activeItem || hasChildMatch(item, activeItem);
  const createActions = getCreateActions(link.children);

  return (
    <div className={styles.flyout} data-rail-flyout>
      <div className={styles.titleRow}>
        {link.url ? (
          <Link href={link.url} className={cx(styles.title, styles.titleLink)} onClick={onNavigate}>
            {link.text}
          </Link>
        ) : (
          <div className={styles.title}>{link.text}</div>
        )}
        <MegaMenuCreateButton
          sectionName={link.text}
          actions={createActions}
          onNavigate={onNavigate}
          onOpenChange={onCreateMenuOpenChange}
        />
      </div>
      <ul className={styles.list}>
        {items.map((item) => {
          const grandchildren = getFlyoutChildren(item);
          return (
            <li key={item.id ?? item.text}>
              {item.url && grandchildren.length === 0 ? (
                <Link
                  href={item.url}
                  className={cx(styles.link, isCurrent(item) && styles.current)}
                  aria-current={isCurrent(item) ? 'page' : undefined}
                  onClick={onNavigate}
                >
                  {item.text}
                </Link>
              ) : (
                <div className={styles.subheading}>{item.text}</div>
              )}
              {grandchildren.length > 0 && (
                <ul className={styles.list}>
                  {grandchildren.map((grandchild) => (
                    <li key={grandchild.id ?? grandchild.text}>
                      <Link
                        href={grandchild.url ?? ''}
                        className={cx(styles.link, styles.nested, isCurrent(grandchild) && styles.current)}
                        aria-current={isCurrent(grandchild) ? 'page' : undefined}
                        onClick={onNavigate}
                      >
                        {grandchild.text}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function getFlyoutChildren(item: NavModelItem): NavModelItem[] {
  return (item.children ?? []).filter((child) => child.url && !child.isCreateAction);
}

const getFlyoutStyles = (theme: GrafanaTheme2) => ({
  flyout: css({
    display: 'flex',
    flexDirection: 'column',
    fontSize: theme.typography.body.fontSize,
    gap: theme.spacing(0.5),
    maxHeight: '70vh',
    minWidth: 240,
    overflowY: 'auto',
    padding: theme.spacing(0.5),
  }),
  // Title > group heading > page, each step clearly smaller or quieter than the one above
  title: css({
    fontSize: theme.typography.h5.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    lineHeight: theme.typography.h5.lineHeight,
    padding: theme.spacing(0.75, 1.5),
  }),
  titleRow: css({
    alignItems: 'center',
    display: 'flex',
    gap: theme.spacing(0.5),
    '& > :first-child': {
      flex: 1,
    },
  }),
  titleLink: css({
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
    display: 'block',
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  list: css({
    listStyle: 'none',
    margin: 0,
    padding: 0,
  }),
  link: css({
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    display: 'block',
    padding: theme.spacing(0.75, 1.5),
    '&:hover': {
      background: theme.colors.action.hover,
      color: theme.colors.text.primary,
    },
  }),
  nested: css({
    paddingLeft: theme.spacing(3),
  }),
  // Matches the rail's and the mega menu's active item
  current: css({
    background: theme.colors.accent.subtleBackground,
    color: theme.colors.accent.text,
    '&:hover': {
      background: theme.colors.accent.subtleBackground,
      color: theme.colors.accent.textEmphasis,
    },
  }),
  subheading: css({
    color: theme.colors.text.primary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    padding: theme.spacing(1, 1.5, 0.5, 1.5),
  }),
});

const getStyles = (theme: GrafanaTheme2, visualRefreshEnabled: boolean) => ({
  rail: css({
    alignItems: 'center',
    background: visualRefreshEnabled ? theme.colors.background.canvas : theme.colors.background.primary,
    borderRight: `1px solid ${theme.colors.border.weak}`,
    display: 'flex',
    flexDirection: 'column',
    width: MENU_RAIL_WIDTH,
  }),
  // Fixed offsets rather than centring (the right border makes the rail 47px inside), so the logo and
  // icons sit exactly where the docked menu puts them and don't shift when it opens
  header: css({
    alignItems: 'center',
    alignSelf: 'stretch',
    borderBottom: visualRefreshEnabled ? undefined : `1px solid ${theme.colors.border.weak}`,
    display: 'flex',
    flexShrink: 0,
    height: getChromeHeaderLevelHeight(),
    paddingLeft: theme.spacing(1.5),
  }),
  content: css({
    flex: 1,
    minHeight: 0,
    width: '100%',
  }),
  // Same top padding and 32px rows as the mega menu's item list, so its rows open level with these icons
  list: css({
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    listStyle: 'none',
    margin: 0,
    padding: theme.spacing(1, 0, 1, 1),
  }),
  // Row, icon and active styles follow MegaMenuItem / MegaMenuItemText, so the rail reads as the same menu
  item: css({
    alignItems: 'center',
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    display: 'flex',
    height: theme.spacing(4),
    justifyContent: 'center',
    position: 'relative',
    width: theme.spacing(4),
    '&:hover': {
      backgroundColor: theme.colors.action.hover,
      color: theme.colors.text.primary,
    },
    '&:focus-visible': getFocusStyles(theme),
  }),
  // Only the current section is coloured, so it stands out among the neutral icons
  itemActive: visualRefreshEnabled
    ? css({
        backgroundColor: theme.colors.accent.subtleBackground,
        color: theme.colors.accent.text,
        '&:hover': {
          backgroundColor: theme.colors.accent.subtleBackground,
          color: theme.colors.accent.textEmphasis,
        },
      })
    : css({
        backgroundColor: theme.colors.action.selected,
        color: theme.colors.accent.text,
        '&::before': {
          backgroundImage: theme.colors.gradients.brandVertical,
          borderRadius: theme.shape.radius.default,
          content: '" "',
          display: 'block',
          height: '100%',
          left: 0,
          position: 'absolute',
          transform: 'translateX(-50%)',
          width: theme.spacing(0.25),
        },
      }),
  // Slightly larger than the full menu's icons, since the rail has no labels
  icon: css({
    height: '20px',
    width: '20px',
  }),
  img: css({
    height: '20px',
    width: '20px',
  }),
  // Same left offset as the docked menu's footer, which holds the same buttons
  footer: css({
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    gap: theme.spacing(1),
    padding: theme.spacing(1, 0, 1.5, 1),
  }),
  footerList: css({
    padding: 0,
  }),
});
