import React, { ReactNode } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Link, useTheme2 } from '@grafana/ui';
import NavBarDropdown from './NavBarDropdown';

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
}: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme, isActive);
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

  return (
    <div className={cx(styles.container, className)}>
      {element}
      {showMenu && (
        <NavBarDropdown
          headerTarget={target}
          headerText={label}
          headerUrl={url}
          items={menuItems}
          onHeaderClick={onClick}
          reverseDirection={reverseMenuDirection}
          subtitleText={menuSubTitle}
        />
      )}
    </div>
  );
};

export default NavBarItem;

const getStyles = (theme: GrafanaTheme2, isActive: Props['isActive']) => ({
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
      outline-offset: -2px;
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
});
