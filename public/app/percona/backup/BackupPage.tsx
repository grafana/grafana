import React, { FC, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import { UrlQueryValue } from '@grafana/data';
import { getLocationSrv } from '@grafana/runtime';
import { Tab, TabContent, TabsBar, useStyles } from '@grafana/ui';
import { Breadcrumb } from 'app/core/components/Breadcrumb';
import { StoreState } from 'app/types';

import { TechnicalPreview } from '../shared/components/Elements/TechnicalPreview/TechnicalPreview';

import { getStyles } from './Backup.styles';
import { TabKeys } from './Backup.types';
import { PAGE_MODEL, PAGE_TABS, DEFAULT_TAB } from './BackupPage.constants';
import { BackupInventory } from './components/BackupInventory';
import { StorageLocations } from './components/StorageLocations';

const BackupPage: FC = () => {
  const [activeTab, setActiveTab] = useState(TabKeys.locations);
  const tabKey = useSelector((state: StoreState) => state.location.routeParams.tab);
  const styles = useStyles(getStyles);
  const tabComponentMap = useMemo(
    () => [
      {
        id: TabKeys.inventory,
        component: <BackupInventory />,
      },
      {
        id: TabKeys.locations,
        component: <StorageLocations />,
      },
    ],
    []
  );

  const { path: basePath } = PAGE_MODEL;

  const isValidTab = (tab: UrlQueryValue) => Object.values(TabKeys).includes(tab as TabKeys);

  useEffect(() => {
    const selectTab = (tabKey: string) => {
      getLocationSrv().update({
        path: `${basePath}/${tabKey}`,
      });
    };
    isValidTab(tabKey) || selectTab(DEFAULT_TAB);
  }, [tabKey, basePath]);

  useEffect(() => {
    setActiveTab(isValidTab(tabKey) ? (tabKey as TabKeys) : DEFAULT_TAB);
  }, [tabKey]);

  return (
    <div className={styles.backupWrapper}>
      <Breadcrumb pageModel={PAGE_MODEL} />
      <TechnicalPreview />
      <TabsBar>
        {PAGE_TABS.map((tab) => (
          <Tab key={tab.id} label={tab.title} active={tab.id === activeTab} onChangeTab={() => selectTab(tab.id)} />
        ))}
      </TabsBar>
      <TabContent>{tabComponentMap.find((tab) => tab.id === activeTab)?.component}</TabContent>
    </div>
  );
};

export default BackupPage;
