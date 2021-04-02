import React, { FC, useEffect, useMemo, useState } from 'react';
import { Tab, TabContent, TabsBar, useStyles } from '@grafana/ui';
import { getLocationSrv } from '@grafana/runtime';
import { UrlQueryValue } from '@grafana/data';
import { useSelector } from 'react-redux';
import { StoreState } from 'app/types';
import { Breadcrumb } from 'app/core/components/Breadcrumb';
import { TabKeys } from './Backup.types';
import { getStyles } from './Backup.styles';
import { StorageLocations } from './components/StorageLocations';
import { DEFAULT_TAB, PAGE_MODEL, PAGE_TABS } from './BackupPage.constants';
import { TechnicalPreview } from '../shared/components/Elements/TechnicalPreview/TechnicalPreview';

const BackupPage: FC = () => {
  const [activeTab, setActiveTab] = useState(TabKeys.locations);
  const tabKey = useSelector((state: StoreState) => state.location.routeParams.tab);
  const styles = useStyles(getStyles);
  const tabComponentMap = useMemo(
    () => [
      {
        id: TabKeys.locations,
        component: <StorageLocations />,
      },
    ],
    []
  );

  const { path: basePath } = PAGE_MODEL;

  const isValidTab = (tab: UrlQueryValue) => Object.values(TabKeys).includes(tab as TabKeys);

  const selectTab = (tabKey: string) => {
    getLocationSrv().update({
      path: `${basePath}/${tabKey}`,
    });
  };

  useEffect(() => {
    isValidTab(tabKey) || selectTab(DEFAULT_TAB);
  }, []);

  useEffect(() => {
    setActiveTab(isValidTab(tabKey) ? (tabKey as TabKeys) : DEFAULT_TAB);
  }, [tabKey]);

  return (
    <div className={styles.backupWrapper}>
      <Breadcrumb pageModel={PAGE_MODEL} />
      <TechnicalPreview />
      <TabsBar>
        {PAGE_TABS.map(tab => (
          <Tab key={tab.id} label={tab.title} active={tab.id === activeTab} onChangeTab={() => setActiveTab(tab.id)} />
        ))}
      </TabsBar>
      <TabContent>{tabComponentMap.find(tab => tab.id === activeTab)?.component}</TabContent>
    </div>
  );
};

export default BackupPage;
