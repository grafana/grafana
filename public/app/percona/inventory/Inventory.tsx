import React, { useEffect, useMemo } from 'react';
import { Tab, TabContent, TabsBar } from '@grafana/ui';
import { Agents, NodesTab, Services } from './Tabs';
import * as styles from './Inventory.styles';
import { useSelector } from 'react-redux';
import { StoreState } from '../../types';
import { UrlQueryValue } from '@grafana/data';
import { getLocationSrv } from '@grafana/runtime';
import { PageModel } from '../../core/components/Breadcrumb';
import PageWrapper from '../shared/components/PageWrapper/PageWrapper';

export enum TabKeys {
  services = 'services',
  agents = 'agents',
  nodes = 'nodes',
}

export const DEFAULT_TAB = 'services';

export const PAGE_TABS = [
  {
    title: 'Services',
    id: TabKeys.services,
    path: `inventory/services`,
  },
  {
    title: 'Agents',
    id: TabKeys.agents,
    path: `inventory/agents`,
  },
  {
    title: 'Nodes',
    id: TabKeys.nodes,
    path: `inventory/nodes`,
  },
];

export const PAGE_MODEL: PageModel = {
  title: 'Inventory',
  path: 'inventory',
  id: 'inventory',
  children: PAGE_TABS.map(({ title, id, path }) => ({ title, id, path })),
};

export const InventoryPanel = () => {
  const { path: basePath } = PAGE_MODEL;

  const activeTab = useSelector((state: StoreState) => state.location.routeParams.tab);
  const isSamePage = useSelector((state: StoreState) => state.location.path.includes(basePath));

  const isValidTab = (tab: UrlQueryValue) => Object.values(TabKeys).includes(tab as TabKeys);
  const selectTab = (tabKey: string) => {
    getLocationSrv().update({
      path: `${basePath}/${tabKey}`,
    });
  };
  useEffect(() => {
    if (!isSamePage) {
      return;
    }
    isValidTab(activeTab) || selectTab(DEFAULT_TAB);
  }, []);

  const tabs = useMemo(
    () => [
      { label: 'Services', key: TabKeys.services, active: activeTab === TabKeys.services },
      { label: 'Agents', key: TabKeys.agents, active: activeTab === TabKeys.agents },
      { label: 'Nodes', key: TabKeys.nodes, active: activeTab === TabKeys.nodes },
    ],
    [activeTab]
  );

  return (
    <PageWrapper pageModel={PAGE_MODEL}>
      <div className={styles.inventoryWrapper}>
        <TabsBar>
          {tabs.map((tab, index) => (
            <Tab
              key={index}
              label={tab.label}
              active={tab.active}
              onChangeTab={() => {
                selectTab(tab.key);
              }}
            />
          ))}
        </TabsBar>
        <div className={styles.tabContentWrapper}>
          <TabContent className={styles.tabContent}>
            {tabs[0].active && <Services />}
            {tabs[1].active && <Agents />}
            {tabs[2].active && <NodesTab />}
          </TabContent>
        </div>
      </div>
    </PageWrapper>
  );
};

export default InventoryPanel;
