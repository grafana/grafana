import React, { FC, useMemo, useCallback } from 'react';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { StoreState } from 'app/types';
import { TabKeys } from './types';
import { Messages } from './CheckPanel.messages';
import { AllChecksTab, FailedChecksTab } from './components';
import { PAGE_MODEL } from './CheckPanel.constants';
import PageWrapper from '../shared/components/PageWrapper/PageWrapper';
import { TabbedContent, ContentTab } from '../shared/components/Elements/TabbedContent';
import { FeatureLoader } from '../shared/components/Elements/FeatureLoader';

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

  const featureSelector = useCallback((state: StoreState) => !!state.perconaSettings.sttEnabled, []);

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
            featureName={Messages.advisors}
            featureSelector={featureSelector}
          >
            <Content />
          </FeatureLoader>
        )}
      />
    </PageWrapper>
  );
};

export default CheckPanel;
