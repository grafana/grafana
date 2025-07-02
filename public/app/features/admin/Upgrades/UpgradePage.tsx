import { useState } from 'react';

import { config } from '@grafana/runtime';
import { TabsBar, Tab, Alert, Button, Stack } from '@grafana/ui';
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

const currentVersion = apiVersions ? apiVersions[0].startingVersion : config.buildInfo.version;
const TABS = [
  { id: 'VERSIONS', label: 'Version History' },
  { id: 'CHANGELOG', label: 'Changelog' },
];


function UpgradePage() {
  const [activeTab, setActiveTab] = useState('VERSIONS');


  return (
    <Page navId="upgrade-grafana">
      <Page.Contents>
        {apiVersions.length > 0 ?
      (<Alert title="New version available" severity="info">
        <Stack direction="column" justifyContent="space-between" gap={2} alignItems="flex-start">
          <div>Check below to upgrade to the latest version</div>
        </Stack>
      </Alert>
    ) : (
      <Alert title=":)" severity="success">
        <div>You are running the latest version of Grafana {currentVersion}</div>
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
          {activeTab === 'VERSIONS' ? (
            <VersionList installedVersion={currentVersion} versions={apiVersions} />
          ) : (
            <Changelog sanitizedHTML={''} />
          )}
        </div>
      </Page.Contents>
    </Page>
  );
}

export default UpgradePage;
