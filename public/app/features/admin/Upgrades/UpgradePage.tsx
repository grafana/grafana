import React, { useState } from 'react';

import { config } from '@grafana/runtime';
import { TabsBar, Tab, Alert, Button, Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { getUpgradesAPI } from 'app/features/admin/Upgrades/api';

import { Changelog } from './Changelog';
import { Overview } from './Overview';
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
        notes: item.spec.state === 'new' ? 'New' : '',
        isOutOfSupport: item.spec.is_out_of_support,
        type: item.spec.type,
      }));
    })
    .catch((error) => {
      return [];
    });
};

const apiVersions = await getVersions();

const currentVersion = config.buildInfo.version;

const TABS = [
  { id: 'OVERVIEW', label: 'Overview' },
  { id: 'CHANGELOG', label: 'Changelog' },
  { id: 'VERSIONS', label: 'Version History' },
];
enum TabView {
  OVERVIEW = 'OVERVIEW',
  CHANGELOG = 'CHANGELOG',
  VERSIONS = 'VERSIONS',
}

const versionInfo = apiVersions.find((item) => item.startingVersion === currentVersion);

const TAB_PAGE_MAP: Record<TabView, React.ReactElement> = {
  [TabView.OVERVIEW]: <Overview installedVersion={currentVersion} versions={apiVersions} />,
  [TabView.CHANGELOG]: <Changelog sanitizedHTML={''} />,
  [TabView.VERSIONS]: <VersionList versions={apiVersions} installedVersion={currentVersion} />,
};

//TODO: get changelog
// const getChangelog = () => {
// }

// TODO: get current Grafana version
// const getCurrentGrafanaVersion = () => {

function UpgradePage() {
  const [activeTab, setActiveTab] = useState('OVERVIEW');

  return (
    <Page navId="upgrade-grafana">
      <Page.Contents>
        {versionInfo?.isOutOfSupport && (
          <Alert title="New version available" severity="info">
            <Stack direction="column" justifyContent="space-between" gap={2} alignItems="flex-start">
              <div>Upgrade Grafana to the latest version.</div>
              <Button variant="primary">Upgrade</Button>
            </Stack>
          </Alert>
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
          {activeTab ? (
            TAB_PAGE_MAP[activeTab as TabView]
          ) : (
            <Overview installedVersion={currentVersion} versions={apiVersions} />
          )}
        </div>
      </Page.Contents>
    </Page>
  );
}

export default UpgradePage;
