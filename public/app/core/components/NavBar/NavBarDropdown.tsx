import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { IconName, useTheme2 } from '@grafana/ui';
import { NavBarMenuItem } from './NavBarMenuItem';

interface Props {
  headerTarget?: HTMLAnchorElement['target'];
  headerText: string;
  headerUrl?: string;
  isVisible?: boolean;
  items?: NavModelItem[];
  onHeaderClick?: () => void;
  reverseDirection?: boolean;
  subtitleText?: string;
}

const NavBarDropdown = ({
  headerTarget,
  headerText,
  headerUrl,
  isVisible,
  items = [],
  onHeaderClick,
  reverseDirection = false,
  subtitleText,
}: Props) => {
  const filteredItems = items.filter((item) => !item.hideFromMenu);
  const theme = useTheme2();
  const styles = getStyles(theme, reverseDirection, filteredItems, isVisible);

  return (
    <ul className={`${styles.menu} navbar-dropdown`} role="menu">
      <NavBarMenuItem
        onClick={onHeaderClick}
        styleOverrides={styles.header}
        target={headerTarget}
        text={headerText}
        url={headerUrl}
      />
      {filteredItems.map((child, index) => (
        <NavBarMenuItem
          key={index}
          isDivider={child.divider}
          icon={child.icon as IconName}
          onClick={child.onClick}
          styleOverrides={styles.item}
          target={child.target}
          text={child.text}
          url={child.url}
        />
      ))}
      {subtitleText && <li className={styles.subtitle}>{subtitleText}</li>}
    </ul>
  );
};

export default NavBarDropdown;

const getStyles = (
  theme: GrafanaTheme2,
  reverseDirection: Props['reverseDirection'],
  filteredItems: Props['items'],
  isVisible: Props['isVisible']
) => {
  const adjustHeightForBorder = filteredItems!.length === 0;

  return {
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
    menu: css`
      background-color: ${theme.colors.background.primary};
      border: 1px solid ${theme.components.panel.borderColor};
      bottom: ${reverseDirection ? 0 : 'auto'};
      box-shadow: ${theme.shadows.z3};
      display: flex;
      flex-direction: ${reverseDirection ? 'column-reverse' : 'column'};
      left: 100%;
      list-style: none;
      min-width: 140px;
      opacity: ${isVisible ? 1 : 0};
      position: absolute;
      top: ${reverseDirection ? 'auto' : 0};
      transition: ${theme.transitions.create('opacity')};
      visibility: ${isVisible ? 'visible' : 'hidden'};
      z-index: ${theme.zIndex.sidemenu};
    `,
    subtitle: css`
      border-${reverseDirection ? 'bottom' : 'top'}: 1px solid ${theme.colors.border.weak};
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.bodySmall.fontSize};
      font-weight: ${theme.typography.bodySmall.fontWeight};
      padding: ${theme.spacing(1)} ${theme.spacing(2)} ${theme.spacing(1)};
      white-space: nowrap;
    `,
  };
};
