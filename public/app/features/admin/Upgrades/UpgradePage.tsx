import React, { useState } from 'react';

import { TabsBar, Tab, Alert, Button, Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { Overview } from './Overview';
import { Changelog } from './Changelog';
import { VersionList } from './VersionList';

const mockDetails = {
  overview: '<h2>Grafana Overview</h2><p>This is a mock overview of Grafana.</p>',
  versions: [
    { version: '10.2.0', releaseDate: '2024-06-01', notes: 'Latest stable release.' },
    { version: '10.1.0', releaseDate: '2024-05-01', notes: 'Minor improvements.' },
    { version: '10.0.0', releaseDate: '2024-04-01', notes: 'Major release.' },
  ],
  installedVersion: '10.2.0',
  changelog: '<h2>10.2.0</h2><p>Bug fixes and improvements</p>',
};

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
const TAB_PAGE_MAP: Record<TabView, React.ReactElement> = {
  [TabView.OVERVIEW]: <Overview installedVersion={mockDetails.installedVersion} versions={mockDetails.versions} />,
  [TabView.CHANGELOG]: <Changelog sanitizedHTML={mockDetails.changelog} />,
  [TabView.VERSIONS]: <VersionList versions={mockDetails.versions} installedVersion={mockDetails.installedVersion} />,
};

// TODO: get versions from API
// const getVersions = () => {
// };

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
        <Alert title="New version available" severity="info">
          <Stack direction="column" justifyContent="space-between" gap={2} alignItems="flex-start">
            <div>Upgrade Grafana to the latest version.</div>
            <Button variant="primary">Upgrade</Button>
          </Stack>
        </Alert>
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
            <Overview installedVersion={mockDetails.installedVersion} versions={mockDetails.versions} />
          )}
        </div>
      </Page.Contents>
    </Page>
  );
}

export default UpgradePage;
