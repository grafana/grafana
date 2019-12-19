import React, { FC } from 'react';
import { cx } from 'emotion';
import { NavModelItem } from '@grafana/data';
import { getTabsStyle } from './styles';
import { useTheme } from '../../themes';

interface Props {
  tab: NavModelItem;
  index: number;
  onChangeTab: (index: number) => void;
}

export const TabItem: FC<Props> = ({ onChangeTab, index, tab }) => {
  const tabsStyles = getTabsStyle(useTheme());
  return (
    <div onClick={() => onChangeTab(index)} className={cx(tabsStyles.linkItem, tab.active && tabsStyles.activeStyle)}>
      {tab.text}
    </div>
  );
};
