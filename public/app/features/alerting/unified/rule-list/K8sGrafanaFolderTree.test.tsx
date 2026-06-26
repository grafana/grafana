import { render, screen, within } from 'test/test-utils';

import { type DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { getCustomSearchHandler } from '@grafana/test-utils/handlers';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { resetSearchRules, setSearchRules } from '../mocks/server/handlers/k8s/rulesSearch.k8s';
import { setupPluginsExtensionsHook } from '../testSetup/plugins';

import { K8sGrafanaFolderTree } from './K8sGrafanaFolderTree';

const server = setupMswServer();
setupPluginsExtensionsHook();

const [, { folderA }] = getFolderFixtures();

const realIntersectionObserver = global.IntersectionObserver;

/**
 * The shared jest-setup IntersectionObserver mock omits `intersectionRatio`, which `LoadMoreHelper`
 * requires to fire. This variant reports a full ratio on observe so the children load-more sentinel
 * pages through all child folders as it would on scroll.
 */
function installAutoFiringIntersectionObserver() {
  global.IntersectionObserver = jest.fn().mockImplementation((callback: IntersectionObserverCallback) => ({
    observe: (element: Element) =>
      callback(
        [{ target: element, isIntersecting: true, intersectionRatio: 1 }] as unknown as IntersectionObserverEntry[],
        null as unknown as IntersectionObserver
      ),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
    takeRecords: () => [],
  })) as unknown as typeof IntersectionObserver;
}

beforeEach(() => {
  grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingRuleExternalRead]);
  resetSearchRules();
});

afterEach(() => {
  global.IntersectionObserver = realIntersectionObserver;
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

  it('renders rule-group headers when groupDisplay=rows', async () => {
    setSearchRules([
      { type: 'alertrule', name: 'rule-uid-1', title: 'CPU too high', folder: folderA.item.uid, group: 'group-1' },
    ]);

    const { user } = render(<K8sGrafanaFolderTree />, {
      historyOptions: { initialEntries: ['/?groupDisplay=rows&groupRowStyle=collapsible'] },
    });

    const folderLink = await screen.findByRole('link', { name: folderA.item.title });
    await user.click(within(folderLink.closest('div')!).getByRole('button', { name: /expand folder/i }));

    // The group surfaces as its own header row (collapsed by default) instead of a pill on the rule.
    const groupHeader = await screen.findByRole('link', { name: 'group-1' });
    expect(groupHeader).toBeInTheDocument();
    expect(screen.queryByText('CPU too high')).not.toBeInTheDocument();

    // Expanding the group reveals its rules.
    const groupRow = groupHeader.closest('div')!;
    await user.click(within(groupRow).getByRole('button', { name: /expand group/i }));
    expect(await screen.findByText('CPU too high')).toBeInTheDocument();
  });

  it('pages through child folders on scroll, then loads the folder rules', async () => {
    installAutoFiringIntersectionObserver();
    // One root folder with 25 children — more than the 24-per-page limit, so children span two pages.
    const PARENT_UID = 'bulk-parent';
    const childCount = 25;
    const children: DashboardHit[] = Array.from({ length: childCount }, (_, i) => ({
      resource: 'folders',
      name: `child-${i + 1}`,
      title: `Sub Folder ${String(i + 1).padStart(2, '0')}`,
      folder: PARENT_UID,
    }));
    const hits: DashboardHit[] = [
      { resource: 'folders', name: PARENT_UID, title: 'Bulk Parent', folder: undefined },
      ...children,
    ];
    // getCustomSearchHandler honors `folder`, `type`, `limit` and `offset`, so it paginates.
    server.use(getCustomSearchHandler(hits));
    setSearchRules([
      { type: 'alertrule', name: 'rule-uid-1', title: 'Parent rule', folder: PARENT_UID, group: 'group-1' },
    ]);

    const { user } = render(<K8sGrafanaFolderTree />);

    const folderLink = await screen.findByRole('link', { name: 'Bulk Parent' });
    await user.click(within(folderLink.closest('div')!).getByRole('button', { name: /expand folder/i }));

    // The second page must have loaded: the last child (only reachable via offset paging) is present.
    expect(await screen.findByRole('link', { name: 'Sub Folder 25' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sub Folder 01' })).toBeInTheDocument();

    // The folder's own rules load only after every child page settles.
    expect(await screen.findByText('Parent rule')).toBeInTheDocument();
  });

  it('switches to a flat folder list when a folder filter is active', async () => {
    render(<K8sGrafanaFolderTree namespaceFilter={folderA.item.title} />);

    expect(await screen.findByRole('link', { name: folderA.item.title })).toBeInTheDocument();
  });
});
