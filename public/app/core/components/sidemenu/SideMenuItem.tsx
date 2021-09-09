import React, { ReactNode } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Link, styleMixins, useTheme2 } from '@grafana/ui';
import SideMenuDropDown from './SideMenuDropDown';

export interface Props {
  children: ReactNode;
  label: string;
  menuItems?: NavModelItem[];
  menuSubTitle?: string;
  onClick?: () => void;
  reverseMenuDirection?: boolean;
  target?: HTMLAnchorElement['target'];
  url?: string;
}

const SideMenuItem = ({
  children,
  label,
  menuItems = [],
  menuSubTitle,
  onClick,
  reverseMenuDirection = false,
  target,
  url,
}: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme);
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
        reverseDirection={reverseMenuDirection}
        subtitleText={menuSubTitle}
      />
    </div>
  );
};

export default SideMenuItem;

const getStyles = (theme: GrafanaTheme2) => ({
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
      // needs to be in here to work on safari...
      &:not(:hover) {
        border-left: 2px solid transparent;
      }

      &:hover {
        background-color: ${theme.colors.action.hover};
        border-image: ${theme.colors.gradients.brandVertical};
        border-image-slice: 1;
        border-style: solid;
        border-top: 0;
        border-right: 0;
        border-bottom: 0;
        border-left-width: 2px;

        .dropdown-menu {
          animation: dropdown-anim 150ms ease-in-out 100ms forwards;
          border: none;
          display: flex;
          // important to overlap it otherwise it can be hidden
          // again by the mouse getting outside the hover space
          left: ${theme.components.sidemenu.width - 3}px;
          margin: 0;
          opacity: 0;
          top: 0;
          z-index: ${theme.zIndex.sidemenu};
        }

        &.dropup .dropdown-menu {
          top: auto;
        }
      }
    }
  `,
  element: css`
    background-color: transparent;
    border: 1px solid transparent;
    color: ${theme.colors.text.secondary};
    display: block;
    line-height: 42px;
    text-align: center;
    width: ${theme.components.sidemenu.width - 2}px;

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
