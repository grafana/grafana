import React, { FC, useMemo } from 'react';
import { TabKeys } from './types';
import { Messages } from './CheckPanel.messages';
import { AllChecksTab, FailedChecksTab } from './components';
import { PAGE_MODEL } from './CheckPanel.constants';
import PageWrapper from '../shared/components/PageWrapper/PageWrapper';
import { TabbedContent, ContentTab } from '../shared/components/Elements/TabbedContent';
import { FeatureLoader } from '../shared/components/Elements/FeatureLoader';

export const CheckPanel: FC = () => {
  const { path: basePath } = PAGE_MODEL;
  const tabs = useMemo<ContentTab[]>(
    (): ContentTab[] => [
      {
        label: Messages.failedChecksTitle,
        key: TabKeys.failedChecks,
        component: <FailedChecksTab key="failed-checks" />,
      },
      {
        label: Messages.allChecksTitle,
        key: TabKeys.allChecks,
        component: <AllChecksTab key="all-checks" />,
      },
    ],
    []
  );

  return (
    <PageWrapper pageModel={PAGE_MODEL} dataQa="db-check-panel">
      <TabbedContent
        tabs={tabs}
        basePath={basePath}
        tabsDataQa="db-check-tabs-bar"
        contentDataQa="db-check-tab-content"
        renderTab={({ Content }) => (
          <FeatureLoader
            messageDataQa="db-check-panel-settings-link"
            featureName={Messages.stt}
            featureFlag="sttEnabled"
          >
            <Content />
          </FeatureLoader>
        )}
      />
    </PageWrapper>
  );
};

export default CheckPanel;
