import React, { FC, useMemo, useCallback } from 'react';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { StoreState } from 'app/types';
import { TabbedContent, ContentTab } from '../shared/components/Elements/TabbedContent';
import { TechnicalPreview } from '../shared/components/Elements/TechnicalPreview/TechnicalPreview';
import PageWrapper from '../shared/components/PageWrapper/PageWrapper';
import { FeatureLoader } from '../shared/components/Elements/FeatureLoader';
import { TabKeys } from './Backup.types';
import { StorageLocations } from './components/StorageLocations';
import { BackupInventory } from './components/BackupInventory';
import { RestoreHistory } from './components/RestoreHistory';
import { ScheduledBackups } from './components/ScheduledBackups';
import { PAGE_MODEL } from './BackupPage.constants';
import { Messages } from './Backup.messages';

const BackupPage: FC<GrafanaRouteComponentProps<{ tab: string }>> = ({ match }) => {
  const tabs: ContentTab[] = useMemo(
    (): ContentTab[] => [
      {
        key: TabKeys.inventory,
        label: Messages.tabs.inventory,
        component: <BackupInventory />,
      },
      {
        key: TabKeys.restore,
        label: Messages.tabs.restore,
        component: <RestoreHistory />,
      },
      {
        key: TabKeys.scheduled,
        label: Messages.tabs.scheduled,
        component: <ScheduledBackups />,
      },
      {
        key: TabKeys.locations,
        label: Messages.tabs.locations,
        component: <StorageLocations />,
      },
    ],
    []
  );

  const { path: basePath } = PAGE_MODEL;
  const tab = match.params.tab;

  const featureSelector = useCallback((state: StoreState) => !!state.perconaSettings.backupEnabled, []);

  return (
    <PageWrapper pageModel={PAGE_MODEL}>
      <TechnicalPreview />
      <TabbedContent
        activeTabName={tab}
        tabs={tabs}
        basePath={basePath}
        renderTab={({ Content }) => (
          <FeatureLoader featureName={Messages.backupManagement} featureSelector={featureSelector}>
            <Content />
          </FeatureLoader>
        )}
      />
    </PageWrapper>
  );
};

export default BackupPage;
