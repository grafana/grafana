/* eslint-disable react/display-name */
import React, { FC, useEffect, useRef, useCallback } from 'react';
import { getLocationSrv } from '@grafana/runtime';
import { TabContent } from '@grafana/ui';
import { OrientedTabs } from './OrientedTabs/OrientedTabs';
import { ContentTab, TabbedContentProps, TabOrientation } from './TabbedContent.types';

export const TabbedContent: FC<TabbedContentProps> = ({
  tabs = [],
  basePath,
  orientation = TabOrientation.Horizontal,
  className,
  tabsdataTestId = 'tabs',
  contentdataTestId = 'tab-content',
  activeTabName = '',
  renderTab,
}) => {
  const routeUpdated = useRef(false);
  const defaultTab = tabs[0].key;
  const tabKeys = tabs.map((tab) => tab.key);
  const activeTab = tabs.find((tab) => tab.key === activeTabName);

  const selectTab = useCallback(
    (tabKey: string) => {
      if (tabKey !== activeTab?.key) {
        routeUpdated.current = true;
        getLocationSrv().update({
          path: `/${basePath}/${tabKey}`,
        });
      }
    },
    [activeTab?.key, basePath]
  );

  useEffect(() => {
    const isValidTab = (tab?: ContentTab) => Object.values(tabKeys).includes(tab?.key || '');
    isValidTab(activeTab) || selectTab(defaultTab);
  }, [activeTab, defaultTab, selectTab, tabKeys]);

  return (
    <>
      <OrientedTabs
        orientation={orientation}
        tabs={tabs}
        activeTabKey={activeTab?.key}
        className={className}
        dataTestId={tabsdataTestId}
        tabClick={selectTab}
      ></OrientedTabs>
      {routeUpdated.current ? null : renderTab ? (
        renderTab({
          Content: ({ className }) => (
            <TabContent data-testid={contentdataTestId} className={className}>
              {activeTab?.component}
            </TabContent>
          ),
          tab: activeTab,
        })
      ) : (
        <TabContent data-testid={contentdataTestId} className={className}>
          {activeTab?.component}
        </TabContent>
      )}
    </>
  );
};
