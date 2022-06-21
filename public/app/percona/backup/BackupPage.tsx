import React, { FC, useMemo } from 'react';

import { FeatureLoader } from '../shared/components/Elements/FeatureLoader';
import { TabbedContent, ContentTab } from '../shared/components/Elements/TabbedContent';
import { TechnicalPreview } from '../shared/components/Elements/TechnicalPreview/TechnicalPreview';
import PageWrapper from '../shared/components/PageWrapper/PageWrapper';

import { Messages } from './Backup.messages';
import { TabKeys } from './Backup.types';
import { PAGE_MODEL } from './BackupPage.constants';
import { BackupInventory } from './components/BackupInventory';
import { RestoreHistory } from './components/RestoreHistory';
import { StorageLocations } from './components/StorageLocations';

const BackupPage: FC = () => {
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
        key: TabKeys.locations,
        label: Messages.tabs.locations,
        component: <StorageLocations />,
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
