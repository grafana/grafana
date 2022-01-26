import React from 'react';
import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Icon, IconName, Link, useTheme2 } from '@grafana/ui';
import { css } from '@emotion/css';

export interface Props {
  icon?: IconName;
  isActive?: boolean;
  isDivider?: boolean;
  onClick?: () => void;
  styleOverrides?: string;
  target?: HTMLAnchorElement['target'];
  text: string;
  url?: string;
  adjustHeightForBorder?: boolean;
  isMobile?: boolean;
  childrenItems?: NavModelItem[];
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
  childrenItems = [],
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
  if (isMobile) {
    return (
      <>
        {isDivider ? (
          <li data-testid="dropdown-child-divider" className={styles.divider} tabIndex={-1} aria-disabled />
        ) : (
          <li>{element}</li>
        )}
        {!!childrenItems.length &&
          childrenItems.map((item) => (
            <NavBarMenuItem
              text={item.text}
              key={item.id}
              isDivider={item.divider}
              icon={item.icon as IconName}
              target={item.target}
              onClick={item.onClick}
              url={item.url}
              styleOverrides={styleOverrides}
              childrenItems={item.children}
            />
          ))}
      </>
    );
  }

  return isDivider ? <li data-testid="dropdown-child-divider" className={styles.divider} /> : <li>{element}</li>;
}

NavBarMenuItem.displayName = 'NavBarMenuItem';

const getStyles = (theme: GrafanaTheme2, isActive: Props['isActive'], styleOverrides: Props['styleOverrides']) => ({
  divider: css`
    border-bottom: 1px solid ${theme.colors.border.weak};
    height: 1px;
    margin: ${theme.spacing(1)} 0;
    overflow: hidden;
    flex: 1;
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
    position: relative;
    text-align: left;
    white-space: nowrap;
    width: 100%;

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
