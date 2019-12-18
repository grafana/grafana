import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme, NavModelItem } from '@grafana/data';
import { selectThemeVariant, stylesFactory, useTheme } from '../../themes';

export interface Props {
  main: NavModelItem;
  customCss?: string;
}

const getTabsStyle = stylesFactory((theme: GrafanaTheme) => {
  const colors = theme.colors;
  const tabBorderColor = selectThemeVariant({ dark: colors.dark9, light: colors.gray5 }, theme.type);

  return {
    tabs: css`
      position: relative;
      top: 1px;
      display: flex;
    `,
    tabItem: css`
      list-style: none;
    `,
    linkItem: css`
      padding: 10px 15px 9px;
      margin-right: ${theme.spacing.md};
      position: relative;
      display: block;
      border: solid transparent;
      border-width: 0 1px 1px;
      border-radius: 3px 3px 0 0;
      color: ${colors.text};

      i {
        margin-right: 5px;
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
      border-color: ${colors.orange} ${tabBorderColor} transparent;
      background: ${colors.pageBg};
      color: ${colors.link};
      overflow: hidden;

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

export const Tabs: FC<Props> = ({ main, customCss }) => {
  const theme = useTheme();
  const tabsStyles = getTabsStyle(theme);
  return (
    <ul className={`${tabsStyles.tabs} ${customCss && customCss}`}>
      {main.children?.map((tab: NavModelItem, index: number) => {
        if (tab.hideFromTabs) {
          return null;
        }

        return (
          <li className={tabsStyles.tabItem} key={`${tab.url}-${index}`}>
            <a
              className={cx(tabsStyles.linkItem, tab.active && tabsStyles.activeStyle)}
              target={tab.target}
              href={tab.url}
            >
              <i className={tab.icon} />
              {tab.text}
            </a>
          </li>
        );
      })}
    </ul>
  );
};
