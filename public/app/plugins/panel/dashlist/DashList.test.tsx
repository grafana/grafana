import { render, screen, waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { getCustomSearchHandler } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures, setMockStarredDashboards, setMockStarredFolders } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import impressionSrv from 'app/core/services/impression_srv';

import { getPanelProps } from '../test-utils';

import { DashList } from './DashList';
import { type Options } from './panelcfg.gen';

const [_, { folderA, folderA_dashbdD, dashbdE }] = getFolderFixtures();

setBackendSrv(backendSrv);
setupMockServer();

const defaultOptions: Options = {
  includeVars: false,
  keepTime: false,
  maxItems: 10,
  query: '*',
  showFolderNames: false,
  showHeadings: false,
  showRecentlyViewed: false,
  showSearch: false,
  showStarred: false,
  tags: [],
};

const findStarButton = (title: string, isStarred: boolean) =>
  screen.findByRole('button', { name: new RegExp(`^${isStarred ? 'unmark' : 'mark'} "${title}" as favorite`, 'i') });

describe('DashList', () => {
  it('renders different groups of dashboards', async () => {
    const props = getPanelProps({
      ...defaultOptions,
      showHeadings: true,
      showRecentlyViewed: true,
      showStarred: true,
      showSearch: true,
    });
    render(<DashList {...props} />);

    const headings = (await screen.findAllByTestId('dashlist-header')).map((heading) => heading.textContent);
    expect(headings).toEqual(['Starred dashboards', 'Recently viewed dashboards', 'Search']);
  });

  it('renders folder names', async () => {
    const props = getPanelProps({ ...defaultOptions, showStarred: true, showFolderNames: true });
    render(<DashList {...props} />);

    // Based on the fixtures, we expect to see a dashboard that's contained in folderA
    const [folderTitle] = await screen.findAllByText(folderA.item.title);
    expect(folderTitle).toBeInTheDocument();
  });

  it('renders empty state', async () => {
    const props = getPanelProps({
      ...defaultOptions,
      showStarred: false,
      showRecentlyViewed: false,
      showSearch: false,
    });
    render(<DashList {...props} />);

    expect(await screen.findByText('No dashboard groups configured')).toBeInTheDocument();
  });

  it('allows un-starring a dashboard', async () => {
    const props = getPanelProps({
      ...defaultOptions,
      showStarred: true,
    });
    const { user } = render(<DashList {...props} />);

    const starButton = await findStarButton(folderA_dashbdD.item.title, true);

    await user.click(starButton);

    // The row leaves once the stars refetch re-searches, not on a local state write
    await waitFor(() => {
      expect(screen.queryByText(folderA_dashbdD.item.title)).not.toBeInTheDocument();
    });
  });

  it('allows starring a dashboard', async () => {
    const props = getPanelProps({
      ...defaultOptions,
      showStarred: true,
      showSearch: true,
    });

    const { user } = render(<DashList {...props} />);

    const starButton = await findStarButton(dashbdE.item.title, false);

    await user.click(starButton);

    // We use `findAll` because the dashboard will appear in two sections (starred and search)
    // but this is fine, because there will have been none before starring it
    const [unmarkButton] = await screen.findAllByRole('button', {
      name: new RegExp(`^unmark "${dashbdE.item.title}" as favorite`, 'i'),
    });
    expect(unmarkButton).toBeInTheDocument();
  });

  // A dashboard and a folder may share a uid; each is its own row, keyed by kind, or React warns about duplicate
  // keys and the console guard fails the test
  it('lists a starred dashboard and folder that share a uid as two rows', async () => {
    setMockStarredDashboards(['shared']);
    setMockStarredFolders(['shared']);
    server.use(
      getCustomSearchHandler([
        { name: 'shared', title: 'Shared Dashboard', resource: 'dashboards' },
        { name: 'shared', title: 'Shared Folder', resource: 'folders' },
      ])
    );
    const props = getPanelProps({ ...defaultOptions, showStarred: true });
    render(<DashList {...props} />);

    expect(await screen.findByText('Shared Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Shared Folder')).toBeInTheDocument();
  });

  it('shows recently viewed dashboards', async () => {
    impressionSrv.addDashboardImpression(dashbdE.item.uid);
    const props = getPanelProps({
      ...defaultOptions,
      showRecentlyViewed: true,
    });
    render(<DashList {...props} />);

    expect(await screen.findByText(dashbdE.item.title)).toBeInTheDocument();
  });

  it('shows the dashboard description in a tooltip when hovering the description indicator', async () => {
    server.use(
      getCustomSearchHandler([
        {
          name: 'dash-uid',
          title: 'Dashboard with description',
          resource: 'dashboards',
          description: 'Uptime overview',
        },
      ])
    );
    const props = getPanelProps({ ...defaultOptions, showSearch: true });
    const { user } = render(<DashList {...props} />);

    await user.hover(await screen.findByLabelText('Description'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Uptime overview');
  });

  it('does not render a description tooltip indicator when a dashboard has no description', async () => {
    server.use(
      getCustomSearchHandler([{ name: 'dash-uid', title: 'Dashboard without description', resource: 'dashboards' }])
    );
    const props = getPanelProps({ ...defaultOptions, showSearch: true });
    render(<DashList {...props} />);

    expect(await screen.findByText('Dashboard without description')).toBeInTheDocument();
    expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
  });
});
