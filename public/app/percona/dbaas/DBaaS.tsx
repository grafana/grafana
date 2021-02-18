import React, { FC, useState, useMemo } from 'react';
import { TabsBar, TabContent, Tab, useStyles } from '@grafana/ui';
import { KubernetesInventory } from './components/Kubernetes/KubernetesInventory';
import { DBCluster } from './components/DBCluster/DBCluster';
import { useKubernetes } from './components/Kubernetes/Kubernetes.hooks';
import { Messages } from './DBaaS.messages';
import { TabKeys } from './DBaaS.types';
import { getStyles } from './DBaaS.styles';

export const DBaaS: FC = () => {
  const styles = useStyles(getStyles);
  const [activeTab, setActiveTab] = useState(TabKeys.kubernetes);
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
    <div className={styles.panelContentWrapper}>
      <TabsBar>
        {tabs.map((tab, index) => (
          <Tab
            key={index}
            label={tab.label}
            active={tab.key === activeTab}
            style={tab.disabled ? styles.disabled : undefined}
            onChangeTab={() => setActiveTab(tab.key)}
          />
        ))}
      </TabsBar>
      <TabContent>{tabs.map(tab => tab.key === activeTab && tab.component)}</TabContent>
    </div>
  );
};

export default DBaaS;
