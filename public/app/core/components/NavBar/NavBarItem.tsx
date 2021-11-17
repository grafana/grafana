import React, { ReactNode } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { IconName, Link, useTheme2 } from '@grafana/ui';
import { MenuButton } from './NavBarItemButton';
import { Item } from '@react-stately/collections';
import { NavBarMenuItem } from './NavBarMenuItem';

export interface Props {
  isActive?: boolean;
  children: ReactNode;
  className?: string;
  label: string;
  menuItems?: NavModelItem[];
  menuSubTitle?: string;
  onClick?: () => void;
  reverseMenuDirection?: boolean;
  showMenu?: boolean;
  target?: HTMLAnchorElement['target'];
  url?: string;
  id: string;
}

const NavBarItem = ({
  isActive = false,
  children,
  className,
  label,
  menuItems = [],
  menuSubTitle,
  onClick,
  reverseMenuDirection = false,
  showMenu = true,
  target,
  url,
  id,
  link,
  index,
}: Props) => {
  const theme = useTheme2();
  let menuItemsSorted;
  if (menuItems) {
    menuItemsSorted = reverseMenuDirection ? menuItems?.reverse() : menuItems;
  }

  const filteredItems = menuItemsSorted?.filter((item) => !item.hideFromMenu);
  const adjustHeightForBorder = filteredItems!.length === 0;
  const styles = getStyles(theme, isActive, adjustHeightForBorder);

  let element = (
    <button className={styles.element} onClick={onClick} aria-label={label}>
      <span className={styles.icon}>{children}</span>
    </button>
  );

  if (url) {
    element =
      !target && url.startsWith('/') ? (
        <Link
          className={styles.element}
          href={url}
          target={target}
          aria-label={label}
          onClick={onClick}
          aria-haspopup="true"
        >
          <span className={styles.icon}>{children}</span>
        </Link>
      ) : (
        <a href={url} target={target} className={styles.element} onClick={onClick} aria-label={label}>
          <span className={styles.icon}>{children}</span>
        </a>
      );
  }

  return showMenu ? (
    <div className={cx(styles.container, className)}>
      <MenuButton link={link} isActive={isActive} reverseDirection={reverseMenuDirection} menuItems={menuItems}>
        <Item key={id} textValue={link.text}>
          <NavBarMenuItem target={target} text={label} url={url} onClick={onClick} styleOverrides={styles.header} />
        </Item>
        {filteredItems?.map((item, index) => {
          return (
            <Item key={`${item.id}-${index}`} textValue={item.text}>
              <NavBarMenuItem
                key={`${item.url}-${index}`}
                isDivider={item.divider}
                icon={item.icon as IconName}
                onClick={item.onClick}
                target={item.target}
                text={item.text}
                url={item.url}
                styleOverrides={styles.item}
              />
            </Item>
          );
        })}
      </MenuButton>
    </div>
  ) : (
    <div className={cx(styles.container, className)}>{element}</div>
  );
};

export default NavBarItem;

const getStyles = (theme: GrafanaTheme2, isActive: Props['isActive'], adjustHeightForBorder: boolean) => ({
  container: css`
    position: relative;
    color: ${isActive ? theme.colors.text.primary : theme.colors.text.secondary};

    &:hover {
      background-color: ${theme.colors.action.hover};
      color: ${theme.colors.text.primary};

      // TODO don't use a hardcoded class here, use isVisible in NavBarDropdown
      .navbar-dropdown {
        opacity: 1;
        visibility: visible;
      }
    }
  `,
  element: css`
    background-color: transparent;
    border: none;
    color: inherit;
    display: block;
    line-height: ${theme.components.sidemenu.width}px;
    padding: 0;
    text-align: center;
    width: ${theme.components.sidemenu.width}px;

    &::before {
      display: ${isActive ? 'block' : 'none'};
      content: ' ';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      border-radius: 2px;
      background-image: ${theme.colors.gradients.brandVertical};
    }

    &:focus-visible {
      background-color: ${theme.colors.action.hover};
      box-shadow: none;
      color: ${theme.colors.text.primary};
      outline: 2px solid ${theme.colors.primary.main};
      outline-offset: 2px;
      transition: none;
    }
  `,
  icon: css`
    height: 100%;
    width: 100%;

    img {
      border-radius: 50%;
      height: ${theme.spacing(3)};
      width: ${theme.spacing(3)};
    }
  `,
  header: css`
    background-color: ${theme.colors.background.secondary};
    color: ${theme.colors.text.primary};
    height: ${theme.components.sidemenu.width - (adjustHeightForBorder ? 2 : 1)}px;
    font-size: ${theme.typography.h4.fontSize};
    font-weight: ${theme.typography.h4.fontWeight};
    padding: ${theme.spacing(1)} ${theme.spacing(2)};
    white-space: nowrap;
    width: 100%;
  `,
  item: css`
    color: ${theme.colors.text.primary};
  `,
});
