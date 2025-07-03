import { useState, useEffect } from 'react';

import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { TabsBar, Tab, Alert, Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { getUpgradesAPI } from 'app/features/admin/Upgrades/api';

import { Changelog } from './Changelog';
import { VersionList } from './VersionList';

const upgradesApi = getUpgradesAPI();

// Function to fetch the list of Grafana versions from the API
const getVersions = () => {
  return upgradesApi
    .listUpgrades()
    .then((response) => {
      return response.items.map((item) => ({
        startingVersion: item.spec.starting_version,
        version: item.spec.target_version,
        releaseDate: item.spec.target_minor_release_date,
        state: item.spec.state === 'new' ? 'New' : '',
        isOutOfSupport: item.spec.is_out_of_support,
        type: item.spec.type,
        name: item.metadata.name,
      }));
    })
    .catch((error) => {
      return [];
    });
};

const TABS = [
  { id: 'VERSIONS', label: 'Version' },
  // { id: 'CHANGELOG', label: 'Changelog' }, // TODO: add changelog
];

function UpgradePage() {
  const [activeTab, setActiveTab] = useState('VERSIONS');
  const [apiVersions, setApiVersions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentVersion = apiVersions[0]?.startingVersion || config.buildInfo.version;

  // Function to fetch and update versions data
  const fetchVersions = async () => {
    setIsLoading(true);
    try {
      const versions = await getVersions();
      setApiVersions(versions);
    } catch (error) {
      console.error('Error fetching versions:', error);
      setApiVersions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch versions on component mount
  useEffect(() => {
    fetchVersions();
  }, []);

  const dismissFn = async (upgradeID: string) => {
    await upgradesApi.dismissUpgrade(upgradeID);

    // Refetch versions instead of reloading the page
    await fetchVersions();
  };

  return (
    <Page navId="upgrade-grafana">
      <Page.Contents>
        {!isLoading && (
          <>
            {apiVersions.length > 0 ? (
              <Alert title={t('admin.upgrades.new-version-available', 'New version available')} severity="info">
                <Stack direction="column" justifyContent="space-between" gap={2} alignItems="flex-start">
                  <div>
                    <Trans i18nKey="admin.upgrades.check-below">Check below to upgrade to the latest version</Trans>
                  </div>
                </Stack>
              </Alert>
            ) : (
              <Alert title={t('admin.upgrades.up-to-date', "Hurray! You're up-to-date!")} severity="success">
                <div>
                  <Trans i18nKey="admin.upgrades.running-latest">You're running the latest Grafana version</Trans>{' '}
                  <strong>{currentVersion}</strong>
                </div>
              </Alert>
            )}
          </>
        )}
        <div>
          <TabsBar>
            {TABS.map((tab) => (
              <Tab
                key={tab.id}
                label={tab.label}
                active={activeTab === tab.id}
                onChangeTab={() => setActiveTab(tab.id)}
              />
            ))}
          </TabsBar>
          {activeTab === 'VERSIONS' ? (
            <VersionList installedVersion={currentVersion} versions={apiVersions} dismissUpgradeFn={dismissFn} />
          ) : (
            <Changelog sanitizedHTML={''} />
          )}
        </div>
      </Page.Contents>
    </Page>
  );
}

export default UpgradePage;
