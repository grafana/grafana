import React, { FC, useMemo } from 'react';
import { PAGE_MODEL } from './IntegratedAlerting.constants';
import { TabKeys } from './IntegratedAlerting.types';
import { AlertRules, AlertRuleTemplate, Alerts, NotificationChannel } from './components';
import { TechnicalPreview } from '../shared/components/Elements/TechnicalPreview/TechnicalPreview';
import { TabbedContent, ContentTab } from '../shared/components/Elements/TabbedContent';
import { Messages } from './IntegratedAlerting.messages';
import PageWrapper from '../shared/components/PageWrapper/PageWrapper';
import { FeatureLoader } from '../shared/components/Elements/FeatureLoader';

const IntegratedAlertingPage: FC = () => {
  const { path: basePath } = PAGE_MODEL;

  const tabs: ContentTab[] = useMemo(
    (): ContentTab[] => [
      {
        label: Messages.tabs.alerts,
        key: TabKeys.alerts,
        component: <Alerts key={TabKeys.alerts} />,
      },
      {
        label: Messages.tabs.alertRules,
        key: TabKeys.alertRules,
        component: <AlertRules key={TabKeys.alertRules} />,
      },
      {
        label: Messages.tabs.alertRuleTemplates,
        key: TabKeys.alertRuleTemplates,
        component: <AlertRuleTemplate key={TabKeys.alertRuleTemplates} />,
      },
      {
        label: Messages.tabs.notificationChannels,
        key: TabKeys.notificationChannels,
        component: <NotificationChannel key={TabKeys.notificationChannels} />,
      },
    ],
    []
  );

  return (
    <PageWrapper pageModel={PAGE_MODEL}>
      <TechnicalPreview />
      <TabbedContent
        tabs={tabs}
        basePath={basePath}
        renderTab={({ Content }) => (
          <FeatureLoader featureName={Messages.integratedAlerting} featureFlag="alertingEnabled">
            <Content />
          </FeatureLoader>
        )}
      />
    </PageWrapper>
  );
};

export default IntegratedAlertingPage;
