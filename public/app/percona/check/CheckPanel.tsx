import React, { FC, useMemo, useState } from 'react';
import { useStyles } from '@grafana/ui';
import { TabKeys } from './types';
import { getStyles } from './CheckPanel.styles';
import { Messages } from './CheckPanel.messages';
import { AllChecksTab, FailedChecksTab } from './components';
import { PAGE_MODEL } from './CheckPanel.constants';
import PageWrapper from '../shared/components/PageWrapper/PageWrapper';
import { TabbedContent, ContentTab } from '../shared/components/Elements/TabbedContent';
import { FeatureLoader } from '../shared/components/Elements/FeatureLoader';
import { AxiosError } from 'axios';

export const CheckPanel: FC = () => {
  const { path: basePath } = PAGE_MODEL;

  const [hasNoAccess, setHasNoAccess] = useState(false);
  const styles = useStyles(getStyles);

  const handleError = (error: AxiosError) => {
    setHasNoAccess(error.response?.status === 401);
  };

  const tabs = useMemo<ContentTab[]>(
    (): ContentTab[] => [
      {
        label: Messages.failedChecksTitle,
        key: TabKeys.failedChecks,
        component: <FailedChecksTab key="failed-checks" hasNoAccess={hasNoAccess} />,
      },
      {
        label: Messages.allChecksTitle,
        key: TabKeys.allChecks,
        component: <AllChecksTab key="all-checks" />,
      },
    ],
    [hasNoAccess]
  );

  if (hasNoAccess) {
    return (
      <PageWrapper pageModel={PAGE_MODEL} dataQa="db-check-panel">
        <div className={styles.panel}>
          <div className={styles.empty} data-qa="db-check-panel-unauthorized">
            {Messages.unauthorized}
          </div>
        </div>
      </PageWrapper>
    );
  }

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
            onError={handleError}
          >
            <Content />
          </FeatureLoader>
        )}
      />
    </PageWrapper>
  );
};

export default CheckPanel;
