import React, { FC } from 'react';
import { cx } from 'emotion';
import { NavModelItem } from '@grafana/data';
import { getTabsStyle } from './styles';
import { useTheme } from '../../themes';

interface Props {
  tab: NavModelItem;
}

export const TabLink: FC<Props> = ({ tab }) => {
  const theme = useTheme();
  const tabsStyles = getTabsStyle(theme);

  return (
    <a className={cx(tabsStyles.linkItem, tab.active && tabsStyles.activeStyle)} target={tab.target} href={tab.url}>
      <i className={tab.icon} />
      {tab.text}
    </a>
  );
};
