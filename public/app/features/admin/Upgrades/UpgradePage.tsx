import React, { useState } from 'react';

import { Trans } from '@grafana/i18n';
import { TabsBar, Tab } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

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
  changelog: '10.2.0: Bug fixes and improvements',
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
  [TabView.OVERVIEW]: <Overview />,
  [TabView.CHANGELOG]: <Changelog changelog={mockDetails.changelog}/>,
  [TabView.VERSIONS]: <VersionList versions={mockDetails.versions} installedVersion={mockDetails.installedVersion}/>,
};

function Overview() {
  return (<div><Trans i18nKey="upgrades.overveiw.header">Overview of grafana version.</Trans></div>);
}

function UpgradePage() {
  const [activeTab, setActiveTab] = useState('OVERVIEW');
  return (
    <Page navId="upgrade-grafana">
    <Page.Contents>
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

      {activeTab ? TAB_PAGE_MAP[activeTab as TabView] : <Overview />}
    </div>
  </Page.Contents>
</Page>
  );
}

export default UpgradePage;
