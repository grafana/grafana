import React, { FC } from 'react';
import { Tab, TabsBar, useStyles } from '@grafana/ui';
import { TabOrientation } from '../TabbedContent.types';
import { TabsVertical } from 'app/percona/shared/components/Elements/TabsVertical/TabsVertical';
import { OrientedTabContentProps, OrientedTabsProps } from './OrientedTabs.types';
import { getStyles } from './OrientedTabs.styles';

const OrientedTabContent: FC<OrientedTabContentProps> = ({ tabs, activeTabKey, tabClick = () => null }) => {
  const styles = useStyles(getStyles);

  return (
    <>
      {tabs
        .filter((tab) => !tab.hidden)
        .map((tab, index) => (
          <Tab
            key={index}
            label={tab.label}
            active={tab.key === activeTabKey}
            style={tab.disabled ? styles.disabled : undefined}
            onChangeTab={() => tabClick(tab.key)}
          />
        ))}
    </>
  );
};

export const OrientedTabs: FC<OrientedTabsProps> = ({
  orientation = TabOrientation.Horizontal,
  tabs = [],
  activeTabKey,
  dataTestId,
  className,
  tabClick = () => null,
}) =>
  orientation === TabOrientation.Horizontal ? (
    <TabsBar className={className} data-testid={dataTestId}>
      <OrientedTabContent tabs={tabs} activeTabKey={activeTabKey} tabClick={tabClick} />
    </TabsBar>
  ) : (
    <TabsVertical className={className} dataTestId={dataTestId}>
      <OrientedTabContent tabs={tabs} activeTabKey={activeTabKey} tabClick={tabClick} />
    </TabsVertical>
  );
