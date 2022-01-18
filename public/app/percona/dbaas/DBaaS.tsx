import React, { FC, useMemo, useState } from 'react';
import { useStyles } from '@grafana/ui';
import { KubernetesInventory } from './components/Kubernetes/KubernetesInventory';
import { DBCluster } from './components/DBCluster/DBCluster';
import { useKubernetes } from './components/Kubernetes/Kubernetes.hooks';
import { Messages } from './DBaaS.messages';
import { TabKeys } from './DBaaS.types';
import { getStyles } from './DBaaS.styles';
import { PAGE_MODEL } from './DBaaS.constants';
import PageWrapper from '../shared/components/PageWrapper/PageWrapper';
import { TechnicalPreview } from '../shared/components/Elements/TechnicalPreview/TechnicalPreview';
import { TabbedContent, ContentTab } from '../shared/components/Elements/TabbedContent';
import { FeatureLoader } from '../shared/components/Elements/FeatureLoader';
import { isKubernetesListUnavailable } from './components/Kubernetes/Kubernetes.utils';
import { Settings } from '../settings/Settings.types';

export const DBaaS: FC = () => {
  const styles = useStyles(getStyles);
  const [settings, setSettings] = useState<Settings | null>(null);
  const { path: basePath } = PAGE_MODEL;

  const [kubernetes, deleteKubernetes, addKubernetes, getKubernetes, setLoading, kubernetesLoading] = useKubernetes({
    settings,
  });
  const tabs: ContentTab[] = useMemo(
    (): ContentTab[] => [
      {
        label: Messages.tabs.kubernetes,
        key: TabKeys.kubernetes,
        component: (
          <KubernetesInventory
            key={TabKeys.kubernetes}
            kubernetes={kubernetes}
            deleteKubernetes={deleteKubernetes}
            addKubernetes={addKubernetes}
            getKubernetes={getKubernetes}
            setLoading={setLoading}
            loading={kubernetesLoading}
          />
        ),
      },
      {
        label: Messages.tabs.dbcluster,
        key: TabKeys.dbclusters,
        disabled: kubernetes.length === 0 || isKubernetesListUnavailable(kubernetes),
        component: <DBCluster key={TabKeys.dbclusters} kubernetes={kubernetes} />,
      },
    ],
    [kubernetes, kubernetesLoading, addKubernetes, deleteKubernetes, getKubernetes, setLoading]
  );

  return (
    <PageWrapper pageModel={PAGE_MODEL}>
      <TechnicalPreview />
      <div className={styles.panelContentWrapper}>
        <TabbedContent
          tabs={tabs}
          basePath={basePath}
          renderTab={({ Content }) => (
            <FeatureLoader featureName={Messages.dbaas} featureFlag="dbaasEnabled" onSettingsLoaded={setSettings}>
              <Content />
            </FeatureLoader>
          )}
        />
      </div>
    </PageWrapper>
  );
};

export default DBaaS;
