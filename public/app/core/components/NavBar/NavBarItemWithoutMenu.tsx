import { GrafanaTheme2 } from '../../../../../packages/grafana-data';
import { css, cx } from '@emotion/css';
import React, { ReactNode } from 'react';
import { Link, useStyles2, useTheme2 } from '../../../../../packages/grafana-ui';

export interface NavBarItemWithoutMenuProps {
  label: string;
  children: ReactNode;
  className?: string;
  url?: string;
  target?: string;
  isActive?: boolean;
  onClick?: () => void;
  highlighted?: boolean;
}

export function NavBarItemWithoutMenu({
  label,
  children,
  className,
  url,
  target,
  isActive = false,
  onClick,
  highlighted,
}: NavBarItemWithoutMenuProps) {
  const theme = useTheme2();
  const styles = getNavBarItemWithoutMenuStyles(theme, isActive);

  return (
    <li className={cx(styles.container, className)}>
      {!url && (
        <button className={styles.element} onClick={onClick} aria-label={label}>
          <span className={styles.icon}>{children}</span>
        </button>
      )}
      {url && (
        <>
          {!target && url.startsWith('/') ? (
            <Link
              className={cx(styles.element, highlighted && styles.highlighted)}
              href={url}
              target={target}
              aria-label={label}
              onClick={onClick}
              aria-haspopup="true"
            >
              <IconWithHighlight highlighted={highlighted}>{children}</IconWithHighlight>
            </Link>
          ) : (
            <a
              href={url}
              target={target}
              className={cx(styles.element, highlighted && styles.highlighted)}
              onClick={onClick}
              aria-label={label}
            >
              <span className={styles.icon}>{children}</span>
            </a>
          )}
        </>
      )}
    </li>
  );
}

export function getNavBarItemWithoutMenuStyles(theme: GrafanaTheme2, isActive?: boolean) {
  return {
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

    highlighted: css`
      color: ${theme.colors.text.disabled} !important;
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
  };
}

export interface IconWithHighlightProps {
  children: ReactNode;
  highlighted?: boolean;
}

export const IconWithHighlight = ({ children, highlighted }: IconWithHighlightProps): JSX.Element => {
  const styles = useStyles2(getIconStyles);
  return (
    <span className={styles.icon}>
      {children}
      {highlighted && (
        <>
          <span className={styles.badge}>
            PRO <i />
          </span>
          <span className={styles.highlight} />
        </>
      )}
    </span>
  );
};

const getIconStyles = (theme: GrafanaTheme2) => {
  return {
    icon: css`
      height: 100%;
      width: 100%;
      display: block;
      position: relative;

      img {
        border-radius: 50%;
        height: ${theme.spacing(3)};
        width: ${theme.spacing(3)};
      }

      :hover > span {
        visibility: visible;
        opacity: 1;
      }
    `,
    badge: css`
      top: 50%;
      left: 100%;
      transform: translate(0, -50%);
      padding: 4px 8px;
      color: ${theme.colors.text.maxContrast};
      background-color: ${theme.colors.success.main};
      border-radius: 2px;
      position: absolute;
      visibility: hidden;
      opacity: 0;
      transition: opacity 0.4s;
      line-height: 1;

      i {
        position: absolute;
        top: 50%;
        right: 100%;
        margin-top: -12px;
        width: 7px;
        height: 24px;
        overflow: hidden;
      }

      i::after {
        content: '';
        position: absolute;
        width: 12px;
        height: 12px;
        left: 0;
        top: 50%;
        transform: translate(50%, -50%) rotate(-45deg);
        background-color: ${theme.colors.success.main};
      }
    `,
    highlight: css`
      background-color: ${theme.colors.success.main};
      border-radius: 50%;
      width: 6px;
      height: 6px;
      display: inline-block;
      position: absolute;
      top: 50%;
      transform: translateY(-50%);

      :hover {
        background-color: ${theme.colors.success.shade};
      }
    `,
  };
};
