import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, useTheme } from '../../themes';

export interface TabProps {
  label: string;
  active?: boolean;
  icon?: string;
  onChangeTab: () => void;
}

const getTabStyles = stylesFactory((theme: GrafanaTheme) => {
  const colors = theme.colors;

  return {
    tabItem: css`
      list-style: none;
      padding: 10px 15px 9px;
      margin-right: ${theme.spacing.md};
      position: relative;
      display: block;
      border: solid transparent;
      border-width: 0 1px 1px;
      border-radius: ${theme.border.radius.md} ${theme.border.radius.md} 0 0;
      color: ${colors.text};
      cursor: pointer;

      i {
        margin-right: ${theme.spacing.sm};
      }

      .gicon {
        position: relative;
        top: -2px;
      }

      &:hover,
      &:focus {
        color: ${colors.linkHover};
      }
    `,
    activeStyle: css`
      border-color: ${colors.orange} ${colors.pageHeaderBorder} transparent;
      background: ${colors.pageBg};
      color: ${colors.link};
      overflow: hidden;
      cursor: not-allowed;

      &::before {
        display: block;
        content: ' ';
        position: absolute;
        left: 0;
        right: 0;
        height: 2px;
        top: 0;
        background-image: linear-gradient(to right, #f05a28 30%, #fbca0a 99%);
      }
    `,
  };
});

export const Tab: FC<TabProps> = ({ label, active, icon, onChangeTab }) => {
  const theme = useTheme();
  const tabsStyles = getTabStyles(theme);

  return (
    <li className={cx(tabsStyles.tabItem, active && tabsStyles.activeStyle)} onClick={onChangeTab}>
      {icon && <i className={icon} />}
      {label}
    </li>
  );
};
