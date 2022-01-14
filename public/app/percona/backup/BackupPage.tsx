import React, { FC, useMemo } from 'react';
import { TabbedContent, ContentTab } from '../shared/components/Elements/TabbedContent';
import { TechnicalPreview } from '../shared/components/Elements/TechnicalPreview/TechnicalPreview';
import PageWrapper from '../shared/components/PageWrapper/PageWrapper';
import { FeatureLoader } from '../shared/components/Elements/FeatureLoader';
import { TabKeys } from './Backup.types';
import { StorageLocations } from './components/StorageLocations';
import { BackupInventory } from './components/BackupInventory';
import { PAGE_MODEL } from './BackupPage.constants';
import { Messages } from './Backup.messages';

const BackupPage: FC = () => {
  const tabs: ContentTab[] = useMemo(
    (): ContentTab[] => [
      {
        key: TabKeys.locations,
        label: Messages.tabs.locations,
        component: <StorageLocations />,
      },
      {
        key: TabKeys.inventory,
        label: Messages.tabs.inventory,
        component: <BackupInventory />,
      },
    ],
    []
  );

  const { path: basePath } = PAGE_MODEL;

  return (
    <PageWrapper pageModel={PAGE_MODEL}>
      <TechnicalPreview />
      <TabbedContent
        tabs={tabs}
        basePath={basePath}
        renderTab={({ Content }) => (
          <FeatureLoader featureName={Messages.backupManagement} featureFlag="backupEnabled">
            <Content />
          </FeatureLoader>
        )}
      />
    </PageWrapper>
  );
};

export default BackupPage;
