import React, { FC, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { getLocationSrv } from '@grafana/runtime';
import { TabContent } from '@grafana/ui';
import { StoreState } from 'app/types';
import { OrientedTabs } from './OrientedTabs/OrientedTabs';
import { ContentTab, TabbedContentProps, TabOrientation } from './TabbedContent.types';

export const TabbedContent: FC<TabbedContentProps> = ({
  tabs = [],
  basePath,
  orientation = TabOrientation.Horizontal,
  className,
  tabsDataQa = 'tabs',
  contentDataQa = 'tab-content',
  renderTab,
}) => {
  const routeUpdated = useRef(false);
  const defaultTab = tabs[0].key;
  const tabKeys = tabs.map(tab => tab.key);
  const activeTab = useSelector((state: StoreState) => tabs.find(tab => tab.key === state.location.routeParams.tab));
  const isValidTab = (tab?: ContentTab) => Object.values(tabKeys).includes(tab?.key || '');

  const selectTab = (tabKey: string) => {
    if (tabKey !== activeTab?.key) {
      routeUpdated.current = true;
      getLocationSrv().update({
        path: `/${basePath}/${tabKey}`,
      });
    }
  };

  useEffect(() => {
    isValidTab(activeTab) || selectTab(defaultTab);
  }, []);

  return (
    <>
      <OrientedTabs
        orientation={orientation}
        tabs={tabs}
        activeTabKey={activeTab?.key}
        className={className}
        dataQa={tabsDataQa}
        tabClick={selectTab}
      ></OrientedTabs>
      {routeUpdated.current ? null : renderTab ? (
        renderTab({
          Content: ({ className }) => (
            <TabContent data-qa={contentDataQa} className={className}>
              {activeTab?.component}
            </TabContent>
          ),
          tab: activeTab,
        })
      ) : (
        <TabContent data-qa={contentDataQa} className={className}>
          {activeTab?.component}
        </TabContent>
      )}
    </>
  );
};
