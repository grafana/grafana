import React, { useRef } from 'react';
import CSSTransition from 'react-transition-group/CSSTransition';
import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { CollapsableSection, CustomScrollbar, Icon, IconName, useStyles2, useTheme2 } from '@grafana/ui';
import { FocusScope } from '@react-aria/focus';
import { useDialog } from '@react-aria/dialog';
import { OverlayContainer, useOverlay } from '@react-aria/overlays';
import { css, cx } from '@emotion/css';
import { NavBarMenuItem } from './NavBarMenuItem';
import { NavBarItemWithoutMenu } from './NavBarItemWithoutMenu';
import { isMatchOrChildMatch } from '../utils';
import { NavBarToggle } from './NavBarToggle';
import { useLocalStorage } from 'react-use';

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
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    left: 0,
    whiteSpace: 'nowrap',
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
  itemList: css({
    display: 'grid',
    gridAutoRows: `minmax(${theme.spacing(6)}, auto)`,
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
    transitionProperty: 'width, background-color, opacity',
    transitionDuration: `${animationDuration}ms`,
    transitionTimingFunction: theme.transitions.easing.easeInOut,
  };

  const overlayTransition = {
    ...commonTransition,
    transitionProperty: 'width, background-color, box-shadow',
  };

  const backdropTransition = {
    ...commonTransition,
    transitionProperty: 'opacity',
  };

  const overlayOpen = {
    backgroundColor: theme.colors.background.canvas,
    boxShadow: theme.shadows.z3,
    width: '300px',
  };

  const overlayClosed = {
    backgroundColor: theme.colors.background.primary,
    boxShadow: 'none',
    width: theme.spacing(7),
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
      <CollapsibleNavItem link={link} isActive={isMatchOrChildMatch(link, activeItem)}>
        <ul>
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
      <CollapsibleNavItem link={link} isActive={isMatchOrChildMatch(link, activeItem)} className={styles.savedItems}>
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
  item: css({
    padding: `${theme.spacing(1)} 0`,
    whiteSpace: 'normal',
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
  }),
});

function CollapsibleNavItem({
  link,
  isActive,
  children,
  className,
}: {
  link: NavModelItem;
  isActive?: boolean;
  children: React.ReactNode;
  className?: string;
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
        onClick={link.onClick}
        className={styles.collapsibleMenuItem}
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
    placeContent: 'center',
  }),
  collapsibleSectionWrapper: css({
    display: 'flex',
    flexGrow: 1,
    alignSelf: 'start',
    flexDirection: 'column',
  }),
  collapseWrapper: css({
    borderRadius: theme.shape.borderRadius(2),
    paddingRight: theme.spacing(4.25),
    height: theme.spacing(6),
    alignItems: 'center',
  }),
  collapseContent: css({
    padding: 0,
    paddingLeft: theme.spacing(1.25),
  }),
  labelWrapper: css({
    fontSize: '15px',
    color: theme.colors.text.secondary,
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
