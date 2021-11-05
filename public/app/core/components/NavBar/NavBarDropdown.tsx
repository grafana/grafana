import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { IconName, useTheme2 } from '@grafana/ui';
import { NavBarMenuItem } from './NavBarMenuItem';

interface Props {
  headerTarget?: HTMLAnchorElement['target'];
  headerText: string;
  headerUrl?: string;
  items?: NavModelItem[];
  onHeaderClick?: () => void;
  reverseDirection?: boolean;
  subtitleText?: string;
}

const NavBarDropdown = ({
  headerTarget,
  headerText,
  headerUrl,
  items = [],
  onHeaderClick,
  reverseDirection = false,
  subtitleText,
}: Props) => {
  const filteredItems = items.filter((item) => !item.hideFromMenu);
  const theme = useTheme2();
  const styles = getStyles(theme, reverseDirection, filteredItems);

  return (
    <ul className={`${styles.menu} dropdown-menu dropdown-menu--sidemenu`} role="menu">
      <NavBarMenuItem
        className={styles.header}
        onClick={onHeaderClick}
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
  filteredItems: Props['items']
) => {
  const adjustHeightForBorder = filteredItems!.length === 0;

  return {
    header: css`
      background-color: ${theme.colors.background.secondary};
      height: ${theme.components.sidemenu.width - (adjustHeightForBorder ? 2 : 1)}px;
      font-size: ${theme.typography.h4.fontSize};
      font-weight: ${theme.typography.h4.fontWeight};
      white-space: nowrap;
      width: 100%;
    `,
    menu: css`
      border: 1px solid ${theme.components.panel.borderColor};
      flex-direction: ${reverseDirection ? 'column-reverse' : 'column'};
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
