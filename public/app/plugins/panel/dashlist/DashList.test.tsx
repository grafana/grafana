import { http, HttpResponse } from 'msw';
import { render, screen } from 'test/test-utils';

import { setBackendSrv, setStarsSrv } from '@grafana/runtime';
import { getCustomSearchHandler, getKindDiscoveryHandler, getKindSearchHandler } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import {
  getFolderFixtures,
  MOCK_STARRED_KIND_PAGE,
  MOCK_STARRED_KIND_SERVED,
  setMockStarredPluginKind,
} from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import impressionSrv from 'app/core/services/impression_srv';
import { resetStarredKinds } from 'app/features/stars/kinds';
import { CollectionsStarsSrv } from 'app/features/stars/service';

import { getPanelProps } from '../test-utils';

import { DashList } from './DashList';
import { type Options } from './panelcfg.gen';

const [_, { folderA, folderA_dashbdD, dashbdE }] = getFolderFixtures();

setBackendSrv(backendSrv);
// Stars go through the runtime service, which refuses signed-out callers
setStarsSrv(new CollectionsStarsSrv());
contextSrv.isSignedIn = true;
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
    const { user } = render(<DashList {...props} />, {
      preloadedState: { navIndex: { starred: { text: 'Starred', children: [] } } },
    });

    const starButton = await findStarButton(folderA_dashbdD.item.title, true);

    await user.click(starButton);

    expect(screen.queryByText(folderA_dashbdD.item.title)).not.toBeInTheDocument();
  });

  it('allows starring a dashboard', async () => {
    const props = getPanelProps({
      ...defaultOptions,
      showStarred: true,
      showSearch: true,
    });

    const { user } = render(<DashList {...props} />, {
      preloadedState: { navIndex: { starred: { text: 'Starred', children: [] } } },
    });

    const starButton = await findStarButton(dashbdE.item.title, false);

    await user.click(starButton);

    // We use `findAll` because the dashboard will appear in two sections (starred and search)
    // but this is fine, because there will have been none before starring it
    const [unmarkButton] = await screen.findAllByRole('button', {
      name: new RegExp(`^unmark "${dashbdE.item.title}" as favorite`, 'i'),
    });
    expect(unmarkButton).toBeInTheDocument();
  });

  it('lists a starred app object and un-stars it under its own kind', async () => {
    const thingUuid = '7d0c6f1e-3b2a-4c5d-9e8f-0a1b2c3d4e5f';
    setMockStarredPluginKind(MOCK_STARRED_KIND_SERVED.group, MOCK_STARRED_KIND_SERVED.kind, [thingUuid]);
    resetStarredKinds();
    const deletedStars: string[] = [];
    server.use(
      getKindDiscoveryHandler(MOCK_STARRED_KIND_SERVED),
      getKindSearchHandler(MOCK_STARRED_KIND_SERVED, [
        { name: thingUuid, title: 'Capacity review', folder: folderA.item.uid },
      ]),
      http.delete(
        '/apis/collections.grafana.app/v1alpha1/namespaces/:namespace/stars/:name/update/:group/:kind/:id',
        ({ params }) => {
          deletedStars.push(`${params.group}/${params.kind}/${params.id}`);
          return HttpResponse.json({ kind: 'Status', apiVersion: 'v1', metadata: {}, code: 200 });
        }
      )
    );
    // The mock replaceVariables returns undefined, which the row would otherwise append to every href
    const props = getPanelProps({ ...defaultOptions, showStarred: true });
    jest.mocked(props.replaceVariables).mockImplementation((value) => value);

    // The plugin's page in the nav tree is what links the kind into the plugin
    const { user } = render(<DashList {...props} />, {
      preloadedState: {
        navIndex: { starred: { text: 'Starred', children: [] } },
        navBarTree: [MOCK_STARRED_KIND_PAGE],
      },
    });

    const thingLink = await screen.findByRole('link', { name: 'Capacity review' });
    expect(thingLink).toHaveAttribute('href', `/a/test-things-app/things/${thingUuid}`);

    await user.click(await findStarButton('Capacity review', true));

    // The star targets the row's own kind, not the dashboard kind every row used to get
    expect(deletedStars).toEqual([`${MOCK_STARRED_KIND_SERVED.group}/${MOCK_STARRED_KIND_SERVED.kind}/${thingUuid}`]);
    expect(screen.queryByText('Capacity review')).not.toBeInTheDocument();
    resetStarredKinds();
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
