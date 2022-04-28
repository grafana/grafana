import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, IconName, Link, useTheme2 } from '@grafana/ui';

export interface Props {
  icon?: IconName;
  isActive?: boolean;
  isDivider?: boolean;
  onClick?: () => void;
  styleOverrides?: string;
  target?: HTMLAnchorElement['target'];
  text: React.ReactNode;
  url?: string;
  adjustHeightForBorder?: boolean;
  isMobile?: boolean;
}

export function NavBarMenuItem({
  icon,
  isActive,
  isDivider,
  onClick,
  styleOverrides,
  target,
  text,
  url,
  isMobile = false,
}: Props) {
  const theme = useTheme2();
  const styles = getStyles(theme, isActive, styleOverrides);

  const linkContent = (
    <div className={styles.linkContent}>
      <div>
        {icon && <Icon data-testid="dropdown-child-icon" name={icon} className={styles.icon} />}
        {text}
      </div>
      {target === '_blank' && (
        <Icon data-testid="external-link-icon" name="external-link-alt" className={styles.externalLinkIcon} />
      )}
    </div>
  );

  let element = (
    <button className={styles.element} onClick={onClick} tabIndex={-1}>
      {linkContent}
    </button>
  );

  if (url) {
    element =
      !target && url.startsWith('/') ? (
        <Link className={styles.element} href={url} target={target} onClick={onClick} tabIndex={!isMobile ? -1 : 0}>
          {linkContent}
        </Link>
      ) : (
        <a href={url} target={target} className={styles.element} onClick={onClick} tabIndex={!isMobile ? -1 : 0}>
          {linkContent}
        </a>
      );
  }

  if (isMobile) {
    return isDivider ? (
      <li data-testid="dropdown-child-divider" className={styles.divider} tabIndex={-1} aria-disabled />
    ) : (
      <li className={styles.listItem}>{element}</li>
    );
  }

  return isDivider ? (
    <div data-testid="dropdown-child-divider" className={styles.divider} tabIndex={-1} aria-disabled />
  ) : (
    <div style={{ position: 'relative' }}>{element}</div>
  );
}

NavBarMenuItem.displayName = 'NavBarMenuItem';

const getStyles = (theme: GrafanaTheme2, isActive: Props['isActive'], styleOverrides: Props['styleOverrides']) => ({
  visible: css`
    color: ${theme.colors.text.primary} !important;
    opacity: 100% !important;
  `,
  divider: css`
    border-bottom: 1px solid ${theme.colors.border.weak};
    height: 1px;
    margin: ${theme.spacing(1)} 0;
    overflow: hidden;
  `,
  listItem: css`
    position: relative;
    display: flex;
    align-items: center;

    &:hover,
    &:focus-within {
      color: ${theme.colors.text.primary};

      > *:first-child::after {
        background-color: ${theme.colors.action.hover};
      }
    }
  `,
  element: css`
    align-items: center;
    background: none;
    border: none;
    color: ${isActive ? theme.colors.text.primary : theme.colors.text.secondary};
    display: flex;
    font-size: inherit;
    height: 100%;
    padding: 5px 12px 5px 10px;
    text-align: left;
    white-space: nowrap;

    &:focus-visible {
      outline: none;
      box-shadow: none;

      &::after {
        box-shadow: none;
        outline: 2px solid ${theme.colors.primary.main};
        outline-offset: -2px;
        transition: none;
      }
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

    &::after {
      position: absolute;
      content: '';
      left: 0;
      top: 0;
      bottom: 0;
      right: 0;
    }

    ${styleOverrides};
  `,
  externalLinkIcon: css`
    color: ${theme.colors.text.secondary};
    margin-left: ${theme.spacing(1)};
  `,
  icon: css`
    margin-right: ${theme.spacing(1)};
  `,
  linkContent: css`
    display: flex;
    flex: 1;
    flex-direction: row;
    justify-content: space-between;
  `,
});
