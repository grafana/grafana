import { css, cx } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { OverlayContainer, useOverlay } from '@react-aria/overlays';
import React, { useRef } from 'react';
import CSSTransition from 'react-transition-group/CSSTransition';
import { useLocalStorage } from 'react-use';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { CollapsableSection, CustomScrollbar, Icon, IconButton, IconName, useStyles2, useTheme2 } from '@grafana/ui';

import { isMatchOrChildMatch } from '../utils';

import { NavBarItemWithoutMenu } from './NavBarItemWithoutMenu';
import { NavBarMenuItem } from './NavBarMenuItem';
import { NavBarToggle } from './NavBarToggle';

export interface Props {
  activeItem?: NavModelItem;
  isOpen: boolean;
  navItems: NavModelItem[];
  setMenuAnimationInProgress: (isInProgress: boolean) => void;
  onClose: () => void;
}

export function NavBarMenu({ activeItem, isOpen, navItems, onClose, setMenuAnimationInProgress }: Props) {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const ANIMATION_DURATION = theme.transitions.duration.standard;
  const animStyles = getAnimStyles(theme, ANIMATION_DURATION);
  const ref = useRef(null);
  const { dialogProps } = useDialog({}, ref);
  const { overlayProps, underlayProps } = useOverlay(
    {
      isDismissable: true,
      isOpen,
      onClose,
    },
    ref
  );

  return (
    <OverlayContainer>
      <FocusScope contain restoreFocus autoFocus>
        <CSSTransition
          onEnter={() => setMenuAnimationInProgress(true)}
          onExited={() => setMenuAnimationInProgress(false)}
          appear={isOpen}
          in={isOpen}
          classNames={animStyles.overlay}
          timeout={ANIMATION_DURATION}
        >
          <div data-testid="navbarmenu" ref={ref} {...overlayProps} {...dialogProps} className={styles.container}>
            <div className={styles.mobileHeader}>
              <Icon name="bars" size="xl" />
              <IconButton
                aria-label="Close navigation menu"
                name="times"
                onClick={onClose}
                size="xl"
                variant="secondary"
              />
            </div>
            <NavBarToggle className={styles.menuCollapseIcon} isExpanded={isOpen} onClick={onClose} />
            <nav className={styles.content}>
              <CustomScrollbar hideHorizontalTrack>
                <ul className={styles.itemList}>
                  {navItems.map((link) => (
                    <NavItem link={link} onClose={onClose} activeItem={activeItem} key={link.text} />
                  ))}
                </ul>
              </CustomScrollbar>
            </nav>
          </div>
        </CSSTransition>
      </FocusScope>
      <CSSTransition appear={isOpen} in={isOpen} classNames={animStyles.backdrop} timeout={ANIMATION_DURATION}>
        <div className={styles.backdrop} {...underlayProps} />
      </CSSTransition>
    </OverlayContainer>
  );
}

NavBarMenu.displayName = 'NavBarMenu';

const getStyles = (theme: GrafanaTheme2) => ({
  backdrop: css({
    backdropFilter: 'blur(1px)',
    backgroundColor: theme.components.overlay.background,
    bottom: 0,
    left: 0,
    position: 'fixed',
    right: 0,
    top: 0,
    zIndex: theme.zIndex.modalBackdrop,
  }),
  container: css({
    display: 'flex',
    bottom: 0,
    flexDirection: 'column',
    left: 0,
    paddingTop: theme.spacing(1),
    marginRight: theme.spacing(1.5),
    right: 0,
    zIndex: theme.zIndex.modal,
    position: 'fixed',
    top: 0,
    boxSizing: 'content-box',
    [theme.breakpoints.up('md')]: {
      borderRight: `1px solid ${theme.colors.border.weak}`,
      right: 'unset',
    },
  }),
  content: css({
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
  }),
  mobileHeader: css({
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    display: 'flex',
    justifyContent: 'space-between',
    padding: theme.spacing(1, 2, 2),
    [theme.breakpoints.up('md')]: {
      display: 'none',
    },
  }),
  itemList: css({
    display: 'grid',
    gridAutoRows: `minmax(${theme.spacing(6)}, auto)`,
    minWidth: '300px',
  }),
  menuCollapseIcon: css({
    position: 'absolute',
    top: '43px',
    right: '0px',
    transform: `translateX(50%)`,
  }),
});

const getAnimStyles = (theme: GrafanaTheme2, animationDuration: number) => {
  const commonTransition = {
    transitionDuration: `${animationDuration}ms`,
    transitionTimingFunction: theme.transitions.easing.easeInOut,
    [theme.breakpoints.down('md')]: {
      overflow: 'hidden',
    },
  };

  const overlayTransition = {
    ...commonTransition,
    transitionProperty: 'background-color, box-shadow, width',
    // this is needed to prevent a horizontal scrollbar during the animation on firefox
    '.scrollbar-view': {
      overflow: 'hidden !important',
    },
  };

  const backdropTransition = {
    ...commonTransition,
    transitionProperty: 'opacity',
  };

  const overlayOpen = {
    backgroundColor: theme.colors.background.canvas,
    boxShadow: theme.shadows.z3,
    width: '100%',
    [theme.breakpoints.up('md')]: {
      width: '300px',
    },
  };

  const overlayClosed = {
    boxShadow: 'none',
    width: 0,
    [theme.breakpoints.up('md')]: {
      backgroundColor: theme.colors.background.primary,
      width: theme.spacing(7),
    },
  };

  const backdropOpen = {
    opacity: 1,
  };

  const backdropClosed = {
    opacity: 0,
  };

  return {
    backdrop: {
      appear: css(backdropClosed),
      appearActive: css(backdropTransition, backdropOpen),
      appearDone: css(backdropOpen),
      exit: css(backdropOpen),
      exitActive: css(backdropTransition, backdropClosed),
    },
    overlay: {
      appear: css(overlayClosed),
      appearActive: css(overlayTransition, overlayOpen),
      appearDone: css(overlayOpen),
      exit: css(overlayOpen),
      exitActive: css(overlayTransition, overlayClosed),
    },
  };
};

function NavItem({
  link,
  activeItem,
  onClose,
}: {
  link: NavModelItem;
  activeItem?: NavModelItem;
  onClose: () => void;
}) {
  const styles = useStyles2(getNavItemStyles);

  if (linkHasChildren(link)) {
    return (
      <CollapsibleNavItem onClose={onClose} link={link} isActive={isMatchOrChildMatch(link, activeItem)}>
        <ul className={styles.children}>
          {link.children.map(
            (childLink) =>
              !childLink.divider && (
                <NavBarMenuItem
                  key={`${link.text}-${childLink.text}`}
                  isActive={activeItem === childLink}
                  isDivider={childLink.divider}
                  onClick={() => {
                    childLink.onClick?.();
                    onClose();
                  }}
                  styleOverrides={styles.item}
                  target={childLink.target}
                  text={childLink.text}
                  url={childLink.url}
                  isMobile={true}
                />
              )
          )}
        </ul>
      </CollapsibleNavItem>
    );
  } else if (link.id === 'saved-items') {
    return (
      <CollapsibleNavItem
        onClose={onClose}
        link={link}
        isActive={isMatchOrChildMatch(link, activeItem)}
        className={styles.savedItems}
      >
        <em className={styles.savedItemsText}>No saved items</em>
      </CollapsibleNavItem>
    );
  } else {
    return (
      <li className={styles.flex}>
        <NavBarItemWithoutMenu
          className={styles.itemWithoutMenu}
          elClassName={styles.fullWidth}
          label={link.text}
          url={link.url}
          target={link.target}
          onClick={() => {
            link.onClick?.();
            onClose();
          }}
          isActive={link === activeItem}
        >
          <div className={styles.savedItemsMenuItemWrapper}>
            <div className={styles.iconContainer}>
              {link.icon && <Icon name={link.icon as IconName} size="xl" />}
              {link.img && (
                <img src={link.img} alt={`${link.text} logo`} height="24" width="24" style={{ borderRadius: '50%' }} />
              )}
            </div>
            <span className={styles.linkText}>{link.text}</span>
          </div>
        </NavBarItemWithoutMenu>
      </li>
    );
  }
}

const getNavItemStyles = (theme: GrafanaTheme2) => ({
  children: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  item: css({
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,
    '&::before': {
      display: 'none',
    },
  }),
  savedItems: css({
    background: theme.colors.background.secondary,
  }),
  savedItemsText: css({
    display: 'block',
    paddingBottom: theme.spacing(2),
    color: theme.colors.text.secondary,
  }),
  flex: css({
    display: 'flex',
  }),
  itemWithoutMenu: css({
    position: 'relative',
    placeItems: 'inherit',
    justifyContent: 'start',
    display: 'flex',
    flexGrow: 1,
    alignItems: 'center',
  }),
  fullWidth: css({
    height: '100%',
    width: '100%',
  }),
  iconContainer: css({
    display: 'flex',
    placeContent: 'center',
  }),
  savedItemsMenuItemWrapper: css({
    display: 'grid',
    gridAutoFlow: 'column',
    gridTemplateColumns: `${theme.spacing(7)} auto`,
    alignItems: 'center',
    height: '100%',
  }),
  linkText: css({
    fontSize: theme.typography.pxToRem(14),
    justifySelf: 'start',
    padding: theme.spacing(0.5, 4.25, 0.5, 0.5),
  }),
});

function CollapsibleNavItem({
  link,
  isActive,
  children,
  className,
  onClose,
}: {
  link: NavModelItem;
  isActive?: boolean;
  children: React.ReactNode;
  className?: string;
  onClose: () => void;
}) {
  const styles = useStyles2(getCollapsibleStyles);
  const [sectionExpanded, setSectionExpanded] = useLocalStorage(`grafana.navigation.expanded[${link.text}]`, false);

  return (
    <li className={cx(styles.menuItem, className)}>
      <NavBarItemWithoutMenu
        isActive={isActive}
        label={link.text}
        url={link.url}
        target={link.target}
        onClick={() => {
          link.onClick?.();
          onClose();
        }}
        className={styles.collapsibleMenuItem}
        elClassName={styles.collapsibleIcon}
      >
        {link.img && (
          <img src={link.img} alt={`${link.text} logo`} height="24" width="24" style={{ borderRadius: '50%' }} />
        )}
        {link.icon && <Icon name={link.icon as IconName} size="xl" />}
      </NavBarItemWithoutMenu>
      <div className={styles.collapsibleSectionWrapper}>
        <CollapsableSection
          isOpen={Boolean(sectionExpanded)}
          onToggle={(isOpen) => setSectionExpanded(isOpen)}
          className={styles.collapseWrapper}
          contentClassName={styles.collapseContent}
          label={
            <div className={cx(styles.labelWrapper, { [styles.primary]: isActive })}>
              <span className={styles.linkText}>{link.text}</span>
            </div>
          }
        >
          {children}
        </CollapsableSection>
      </div>
    </li>
  );
}

const getCollapsibleStyles = (theme: GrafanaTheme2) => ({
  menuItem: css({
    position: 'relative',
    display: 'grid',
    gridAutoFlow: 'column',
    gridTemplateColumns: '56px auto',
  }),
  collapsibleMenuItem: css({
    height: theme.spacing(6),
    width: theme.spacing(7),
    display: 'grid',
  }),
  collapsibleIcon: css({
    display: 'grid',
    placeContent: 'center',
  }),
  collapsibleSectionWrapper: css({
    display: 'flex',
    flexGrow: 1,
    alignSelf: 'start',
    flexDirection: 'column',
  }),
  collapseWrapper: css({
    paddingLeft: theme.spacing(0.5),
    paddingRight: theme.spacing(4.25),
    minHeight: theme.spacing(6),
    overflowWrap: 'anywhere',
    alignItems: 'center',
    color: theme.colors.text.secondary,
    '&:hover, &:focus-within': {
      backgroundColor: theme.colors.action.hover,
      color: theme.colors.text.primary,
    },
    '&:focus-within': {
      boxShadow: 'none',
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: '-2px',
      transition: 'none',
    },
  }),
  collapseContent: css({
    padding: 0,
  }),
  labelWrapper: css({
    fontSize: '15px',
  }),
  primary: css({
    color: theme.colors.text.primary,
  }),
  linkText: css({
    fontSize: theme.typography.pxToRem(14),
    justifySelf: 'start',
  }),
});

function linkHasChildren(link: NavModelItem): link is NavModelItem & { children: NavModelItem[] } {
  return Boolean(link.children && link.children.length > 0);
}
