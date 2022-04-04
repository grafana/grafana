import React, { useRef } from 'react';
import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { CollapsableSection, CustomScrollbar, Icon, IconName, useStyles2 } from '@grafana/ui';
import { FocusScope } from '@react-aria/focus';
import { useDialog } from '@react-aria/dialog';
import { useOverlay } from '@react-aria/overlays';
import { css, cx } from '@emotion/css';
import { NavBarMenuItem } from './NavBarMenuItem';
import { NavBarItemWithoutMenu } from './NavBarItemWithoutMenu';
import { isMatchOrChildMatch } from '../utils';
import { NavBarToggle } from './NavBarToggle';

export interface Props {
  activeItem?: NavModelItem;
  isOpen: boolean;
  navItems: NavModelItem[];
  onClose: () => void;
}

export function NavBarMenu({ activeItem, isOpen, navItems, onClose }: Props) {
  const styles = useStyles2(getStyles);
  const ref = useRef(null);
  const { dialogProps } = useDialog({}, ref);
  const { overlayProps } = useOverlay(
    {
      isDismissable: true,
      isOpen,
      onClose,
    },
    ref
  );

  return (
    <div data-testid="navbarmenu" className={styles.container}>
      <FocusScope contain restoreFocus autoFocus>
        <nav className={styles.content} ref={ref} {...overlayProps} {...dialogProps}>
          <NavBarToggle className={styles.menuCollapseIcon} isExpanded={isOpen} onClick={onClose} />
          <CustomScrollbar hideHorizontalTrack>
            <ul className={styles.itemList}>
              {navItems.map((link) => (
                <NavItem link={link} onClose={onClose} activeItem={activeItem} key={link.text} />
              ))}
            </ul>
          </CustomScrollbar>
        </nav>
      </FocusScope>
    </div>
  );
}

NavBarMenu.displayName = 'NavBarMenu';

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    left: 0,
    whiteSpace: 'nowrap',
    paddingTop: theme.spacing(1),
    marginRight: theme.spacing(1.5),
    overflow: 'hidden',
    right: 0,
    zIndex: theme.zIndex.sidemenu,
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
  }),
});

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
          isOpen={false}
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
