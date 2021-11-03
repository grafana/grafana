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

export function NavBarMenuItem({ icon, isActive, isSectionHeader, label, onClick, target, url }: Props) {
  const theme = useTheme2();
  const styles = getStyles(theme, isActive, isSectionHeader);

  const linkContent = (
    <div className={styles.linkContent}>
      <div>
        {icon && <Icon data-testid="dropdown-child-icon" name={icon} className={styles.icon} />}
        {label}
      </div>
      {target === '_blank' && (
        <Icon data-testid="external-link-icon" name="external-link-alt" className={styles.externalLinkIcon} />
      )}
    </div>
  );

  let element = (
    <button className={styles.element} onClick={onClick}>
      {linkContent}
    </button>
  );

  if (url) {
    element =
      !target && url.startsWith('/') ? (
        <Link className={styles.element} href={url} target={target} onClick={onClick}>
          {linkContent}
        </Link>
      ) : (
        <a href={url} target={target} className={styles.element} onClick={onClick}>
          {linkContent}
        </a>
      );
  }

  return <li className={styles.container}>{element}</li>;
}

NavBarMenuItem.displayName = 'NavBarMenu';

const getStyles = (theme: GrafanaTheme2, isActive: Props['isActive'], isSectionHeader: Props['isSectionHeader']) => ({
  container: css`
    display: flex;
  `,
  element: css`
    background: none;
    border: none;
    color: ${isActive ? theme.colors.text.primary : theme.colors.text.secondary};
    font-size: ${isSectionHeader ? theme.typography.h5.fontSize : 'unset'};
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
