import React from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, IconName, Link, useTheme2 } from '@grafana/ui';
import { css } from '@emotion/css';

export interface Props {
  icon?: IconName;
  isActive?: boolean;
  isSectionHeader?: boolean;
  label: string;
  onClick?: () => void;
  target?: HTMLAnchorElement['target'];
  url?: string;
}

export function NavBarMenuItem({
  icon,
  isActive,
  isSectionHeader,
  label,
  onClick,
  target,
  url,
}: Props) {
  const theme = useTheme2();
  const styles = getStyles(theme, isActive, isSectionHeader);

  let element = (
    <button className={styles.element} onClick={onClick}>
      {icon && (
        <Icon className={styles.icon} name={icon} />
      )}
      {label}
    </button>
  );

  if (url) {
    element =
      !target && url.startsWith('/') ? (
        <Link
          className={styles.element}
          href={url}
          target={target}
          onClick={onClick}
        >
          {icon && (
            <Icon className={styles.icon} name={icon} />
          )}
          {label}
        </Link>
      ) : (
        <a href={url} target={target} className={styles.element} onClick={onClick}>
          {icon && (
            <Icon className={styles.icon} name={icon} />
          )}
          {label}
        </a>
      );
  }

  return element;
}

NavBarMenuItem.displayName = 'NavBarMenu';

const getStyles = (theme: GrafanaTheme2, isActive: Props['isActive'], isSectionHeader: Props['isSectionHeader']) => ({
  element: css`
    background: none;
    border: none;
    color: ${isActive ? theme.colors.text.primary : theme.colors.text.secondary};
    font-size: ${isSectionHeader ? theme.typography.h5.fontSize : 'auto'};
    padding: ${theme.spacing(1)} ${theme.spacing(2)};
    position: relative;
    text-align: left;
    width: 100%;

    &:hover,
    &:focus-visible {
      background-color: ${theme.colors.action.hover};
      color: ${theme.colors.text.primary};
    }

    &:focus-visible {
      box-shadow: none;
      outline: 2px solid ${theme.colors.primary.main};
      outline-offset: -2px;
      transition: none;
    }

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
  `,
  icon: css`
    margin-right: ${theme.spacing(1)};
  `
})
