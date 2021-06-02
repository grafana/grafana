import React, { FC, useEffect, useMemo } from 'react';
import { Tab, TabContent, TabsBar, useStyles } from '@grafana/ui';
import { KubernetesInventory } from './components/Kubernetes/KubernetesInventory';
import { DBCluster } from './components/DBCluster/DBCluster';
import { useKubernetes } from './components/Kubernetes/Kubernetes.hooks';
import { Messages } from './DBaaS.messages';
import { TabKeys } from './DBaaS.types';
import { getStyles } from './DBaaS.styles';
import { useSelector } from 'react-redux';
import { StoreState } from '../../types';
import { DEFAULT_TAB, PAGE_MODEL } from './DBaaS.constants';
import { UrlQueryValue } from '@grafana/data';
import { getLocationSrv } from '@grafana/runtime';
import PageWrapper from '../shared/components/PageWrapper/PageWrapper';

export const DBaaS: FC = () => {
  const styles = useStyles(getStyles);
  const { path: basePath } = PAGE_MODEL;

  const activeTab = useSelector((state: StoreState) => state.location.routeParams.tab);
  const isSamePage = useSelector((state: StoreState) => state.location.path.includes(basePath));

  const isValidTab = (tab: UrlQueryValue) => Object.values(TabKeys).includes(tab as TabKeys);
  const selectTab = (tabKey: string) => {
    getLocationSrv().update({
      path: tabKey ? `${basePath}/${tabKey}` : basePath,
    });
  };

  useEffect(() => {
    if (!isSamePage) {
      return;
    }
    isValidTab(activeTab) || selectTab(DEFAULT_TAB);
  }, [activeTab]);

  const [kubernetes, deleteKubernetes, addKubernetes, kubernetesLoading] = useKubernetes();
  const tabs = useMemo(
    () => [
      {
        label: Messages.tabs.kubernetes,
        key: TabKeys.kubernetes,
        component: (
          <KubernetesInventory
            key={TabKeys.kubernetes}
            kubernetes={kubernetes}
            deleteKubernetes={deleteKubernetes}
            addKubernetes={addKubernetes}
            loading={kubernetesLoading}
          />
        ),
      },
      {
        label: Messages.tabs.dbcluster,
        key: TabKeys.dbclusters,
        disabled: kubernetes.length === 0,
        component: <DBCluster key={TabKeys.dbclusters} kubernetes={kubernetes} />,
      },
    ],
    [kubernetes, kubernetesLoading]
  );

  return (
    <PageWrapper pageModel={PAGE_MODEL}>
      <div className={styles.panelContentWrapper}>
        <TabsBar>
          {tabs.map((tab, index) => (
            <Tab
              key={index}
              label={tab.label}
              active={tab.key === activeTab}
              style={tab.disabled ? styles.disabled : undefined}
              onChangeTab={() => selectTab(tab.key)}
            />
          ))}
        </TabsBar>
        <TabContent>{tabs.map(tab => tab.key === activeTab && tab.component)}</TabContent>
      </div>
    </PageWrapper>
  );
};

export default DBaaS;
