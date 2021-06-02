import React, { FC, useEffect, useMemo, useState } from 'react';
import { Spinner, Tab, TabContent, TabsBar, useStyles } from '@grafana/ui';
import { PMM_SETTINGS_URL } from 'app/percona/check/CheckPanel.constants';
import { Settings, TabEntry, TabKeys } from './types';
import { CheckService } from './Check.service';
import { getStyles } from './CheckPanel.styles';
import { Messages } from './CheckPanel.messages';
import { AllChecksTab, FailedChecksTab } from './components';
import { useSelector } from 'react-redux';
import { StoreState } from '../../types';
import { DEFAULT_TAB, PAGE_MODEL } from './CheckPanel.constants';
import { UrlQueryValue } from '@grafana/data';
import { getLocationSrv } from '@grafana/runtime';
import PageWrapper from '../shared/components/PageWrapper/PageWrapper';

export const CheckPanel: FC = () => {
  const { path: basePath } = PAGE_MODEL;

  const activeTab = useSelector((state: StoreState) => state.location.routeParams.tab);
  const isSamePage = useSelector((state: StoreState) => state.location.path.includes(basePath));
  const isValidTab = (tab: UrlQueryValue) => Object.values(TabKeys).includes(tab as TabKeys);
  const selectTab = (tabKey: string) => {
    getLocationSrv().update({
      path: tabKey ? `${basePath}/${tabKey}` : basePath,
    });
  };

  useEffect(() => {
    if (!isSamePage) {
      return;
    }

    isValidTab(activeTab) || selectTab(DEFAULT_TAB);
  }, [activeTab]);

  const [hasNoAccess, setHasNoAccess] = useState(false);
  const [isSttEnabled, setIsSttEnabled] = useState(false);
  const [getSettingsPending, setGetSettingsPending] = useState(false);
  const styles = useStyles(getStyles);

  const getSettings = async () => {
    try {
      setGetSettingsPending(true);
      const resp = (await CheckService.getSettings()) as Settings;

      setIsSttEnabled(!!resp.settings?.stt_enabled);
      setHasNoAccess(false);
    } catch (err) {
      setHasNoAccess(err.response?.status === 401);

      console.error(err);
    } finally {
      setGetSettingsPending(false);
    }
  };

  useEffect(() => {
    getSettings();
  }, []);

  const tabs = useMemo<TabEntry[]>(
    () => [
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
    [hasNoAccess, isSttEnabled]
  );

  if (hasNoAccess) {
    return (
      <PageWrapper pageModel={PAGE_MODEL}>
        <div className={styles.panel} data-qa="db-check-panel">
          <div className={styles.empty} data-qa="db-check-panel-unauthorized">
            {Messages.unauthorized}
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper pageModel={PAGE_MODEL}>
      <div className={styles.panel} data-qa="db-check-panel">
        {getSettingsPending && (
          <div className={styles.spinner} data-qa="db-check-spinner">
            <Spinner />
          </div>
        )}
        {!getSettingsPending &&
          (isSttEnabled ? (
            <>
              <TabsBar className={styles.tabBar} data-qa="db-check-tabs-bar">
                {tabs.map(tab => (
                  <Tab
                    key={tab.key}
                    label={tab.label}
                    active={tab.key === activeTab}
                    onChangeTab={() => selectTab(tab.key)}
                  />
                ))}
              </TabsBar>
              <TabContent className={styles.tabContent} data-qa="db-check-tab-content">
                {tabs.map(tab => tab.key === activeTab && tab.component)}
              </TabContent>
            </>
          ) : (
            <div className={styles.empty}>
              {Messages.sttDisabled}{' '}
              <a className={styles.link} href={PMM_SETTINGS_URL} data-qa="db-check-panel-settings-link">
                {Messages.pmmSettings}
              </a>
            </div>
          ))}
      </div>
    </PageWrapper>
  );
};

export default CheckPanel;
