import React, { FC, useMemo } from 'react';

import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { FeatureLoader } from '../shared/components/Elements/FeatureLoader';
import { ContentTab, TabbedContent } from '../shared/components/Elements/TabbedContent';
import PageWrapper from '../shared/components/PageWrapper/PageWrapper';

import { PAGE_MODEL } from './CheckPanel.constants';
import { Messages } from './CheckPanel.messages';
import { AllChecksTab, FailedChecksTab } from './components';
import { TabKeys } from './types';

export const CheckPanel: FC<GrafanaRouteComponentProps<{ tab: string }>> = ({ match }) => {
  const { path: basePath } = PAGE_MODEL;
  const tab = match.params.tab;
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
    <PageWrapper pageModel={PAGE_MODEL} dataTestId="db-check-panel">
      <TabbedContent
        activeTabName={tab}
        tabs={tabs}
        basePath={basePath}
        tabsdataTestId="db-check-tabs-bar"
        contentdataTestId="db-check-tab-content"
        renderTab={({ Content }) => (
          <FeatureLoader
            messagedataTestId="db-check-panel-settings-link"
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
