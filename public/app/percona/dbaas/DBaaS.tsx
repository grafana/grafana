import React, { FC, useMemo } from 'react';
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

export const DBaaS: FC = () => {
  const styles = useStyles(getStyles);
  const { path: basePath } = PAGE_MODEL;

  const [kubernetes, deleteKubernetes, addKubernetes, kubernetesLoading] = useKubernetes();
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
      <TechnicalPreview />
      <div className={styles.panelContentWrapper}>
        <TabbedContent
          tabs={tabs}
          basePath={basePath}
          renderTab={({ Content }) => (
            <FeatureLoader featureName={Messages.dbaas} featureFlag="dbaasEnabled">
              <Content />
            </FeatureLoader>
          )}
        />
      </div>
    </PageWrapper>
  );
};

export default DBaaS;
