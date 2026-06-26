import { render, screen, within } from 'test/test-utils';

import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { resetSearchRules, setSearchRules } from '../mocks/server/handlers/k8s/rulesSearch.k8s';
import { setupPluginsExtensionsHook } from '../testSetup/plugins';

import { K8sGrafanaFolderTree } from './K8sGrafanaFolderTree';

setupMswServer();
setupPluginsExtensionsHook();

const [, { folderA }] = getFolderFixtures();

beforeEach(() => {
  grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingRuleExternalRead]);
  resetSearchRules();
});

describe('K8sGrafanaFolderTree', () => {
  it('renders all top-level folders from the folders API, including empty ones', async () => {
    render(<K8sGrafanaFolderTree />);

    // folderA is a root folder in the fixture tree; it should appear even with no rules.
    expect(await screen.findByRole('link', { name: folderA.item.title })).toBeInTheDocument();
  });

  it('shows alerting + recording counts on a folder', async () => {
    render(<K8sGrafanaFolderTree />);

    const folderLink = await screen.findByRole('link', { name: folderA.item.title });
    // The link sits in an inner Stack; the counts are a sibling inside the folder header row.
    const folderRow = folderLink.closest('div')!.parentElement!;
    // The fixture counts handler returns 1 alertrule and no recordingrules.
    expect(await within(folderRow).findByText(/1 alerting/)).toBeInTheDocument();
    expect(within(folderRow).getByText(/0 recording/)).toBeInTheDocument();
  });

  it('loads the folder rules from the search endpoint on expand', async () => {
    setSearchRules([
      { type: 'alertrule', name: 'rule-uid-1', title: 'CPU too high', folder: folderA.item.uid, group: 'group-1' },
    ]);

    const { user } = render(<K8sGrafanaFolderTree />);

    const folderLink = await screen.findByRole('link', { name: folderA.item.title });
    const folderRow = folderLink.closest('div')!;
    await user.click(within(folderRow).getByRole('button', { name: /expand folder/i }));

    expect(await screen.findByText('CPU too high')).toBeInTheDocument();
  });

  it('switches to a flat folder list when a folder filter is active', async () => {
    render(<K8sGrafanaFolderTree namespaceFilter={folderA.item.title} />);

    expect(await screen.findByRole('link', { name: folderA.item.title })).toBeInTheDocument();
  });
});
