import React, { ReactNode } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Link, styleMixins, useTheme2 } from '@grafana/ui';
import SideMenuDropDown from './SideMenuDropDown';
import { isHorizontal } from './utils';

export interface Props {
  isActive?: boolean;
  children: ReactNode;
  label: string;
  menuItems?: NavModelItem[];
  menuPosition?: 'left' | 'right' | 'top' | 'bottom';
  menuSubTitle?: string;
  onClick?: () => void;
  reverseMenuDirection?: boolean;
  target?: HTMLAnchorElement['target'];
  url?: string;
}

const SideMenuItem = ({
  isActive = false,
  children,
  label,
  menuItems = [],
  menuPosition = 'right',
  menuSubTitle,
  onClick,
  reverseMenuDirection = false,
  target,
  url,
}: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme, isActive, menuPosition, reverseMenuDirection);
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
    <div className={cx(styles.container, 'dropdown', { dropup: reverseMenuDirection })}>
      {element}
      <SideMenuDropDown
        headerTarget={target}
        headerText={label}
        headerUrl={url}
        items={menuItems}
        onHeaderClick={onClick}
        position={menuPosition}
        reverseDirection={reverseMenuDirection}
        subtitleText={menuSubTitle}
      />
    </div>
  );
};

export default SideMenuItem;

const getStyles = (
  theme: GrafanaTheme2,
  isActive: Props['isActive'],
  menuPosition: Exclude<Props['menuPosition'], undefined>,
  reverseMenuDirection: Props['reverseMenuDirection']
) => ({
  container: css`
    position: relative;

    @keyframes dropdown-anim {
      0% {
        opacity: 0;
      }
      100% {
        opacity: 1;
      }
    }

    @media ${styleMixins.mediaUp(`${theme.breakpoints.values.md}px`)} {
      color: ${isActive ? theme.colors.text.primary : theme.colors.text.secondary};

      &:hover {
        background-color: ${theme.colors.action.hover};
        color: ${theme.colors.text.primary};

        .dropdown-menu {
          animation: dropdown-anim 150ms ease-in-out 100ms forwards;
          border: none;
          display: flex;
          // important to overlap it otherwise it can be hidden
          // again by the mouse getting outside the hover space
          left: ${menuPosition === 'right'
            ? `${theme.components.sidemenu.width}px`
            : `${isHorizontal(menuPosition) && !reverseMenuDirection ? 0 : 'unset'}`};
          right: ${menuPosition === 'left'
            ? `${theme.components.sidemenu.width}px`
            : `${isHorizontal(menuPosition) && reverseMenuDirection ? 0 : 'unset'}`};
          top: ${menuPosition === 'bottom'
            ? `${theme.components.sidemenu.width}px`
            : `${!isHorizontal(menuPosition) && !reverseMenuDirection ? 0 : 'unset'}`};
          bottom: ${menuPosition === 'top'
            ? `${theme.components.sidemenu.width}px`
            : `${!isHorizontal(menuPosition) && reverseMenuDirection ? 0 : 'unset'}`};
          margin: 0;
          opacity: 0;
          z-index: ${theme.zIndex.sidemenu};
        }
      }
    }
  `,
  element: css`
    background-color: transparent;
    border: none;
    color: inherit;
    display: block;
    height: ${theme.components.sidemenu.width}px;
    line-height: ${theme.components.sidemenu.width}px;
    text-align: center;
    width: ${theme.components.sidemenu.width}px;

    &::before {
      display: ${isActive ? 'block' : 'none'};
      content: ' ';
      position: absolute;
      left: ${menuPosition === 'left' ? 'unset' : 0};
      top: ${menuPosition === 'top' ? 'unset' : 0};
      bottom: ${menuPosition === 'bottom' ? 'unset' : 0};
      right: ${menuPosition === 'right' ? 'unset' : 0};
      width: ${!isHorizontal(menuPosition) ? '4px' : 'auto'};
      height: ${isHorizontal(menuPosition) ? '4px' : 'auto'};
      border-radius: 2px;
      background-image: ${isHorizontal(menuPosition)
        ? theme.colors.gradients.brandHorizontal
        : theme.colors.gradients.brandVertical};
    }

    &:focus-visible {
      background-color: ${theme.colors.action.hover};
      box-shadow: none;
      color: ${theme.colors.text.primary};
      outline: 2px solid ${theme.colors.primary.main};
      outline-offset: -2px;
      transition: none;
    }

    .sidemenu-open--xs & {
      display: none;
    }
  `,
  icon: css`
    height: 100%;
    width: 100%;

    img {
      border-radius: 50%;
      height: 28px;
      width: 28px;
    }
  `,
});
