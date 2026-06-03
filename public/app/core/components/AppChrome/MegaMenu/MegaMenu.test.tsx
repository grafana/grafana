import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { render } from 'test/test-utils';

import { type NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';

import { MegaMenu } from './MegaMenu';

setBackendSrv(backendSrv);
setupMockServer();

const defaultNavBarTree: NavModelItem[] = [
  {
    text: 'Section name',
    id: 'section',
    url: 'section',
    children: [
      {
        text: 'Child1',
        id: 'child1',
        url: 'section/child1',
        children: [{ text: 'Grandchild1', id: 'grandchild1', url: 'section/child1/grandchild1' }],
      },
      { text: 'Child2', id: 'child2', url: 'section/child2' },
    ],
  },
  {
    text: 'Profile',
    id: 'profile',
    url: 'profile',
  },
];

const setup = (navBarTree: NavModelItem[] = defaultNavBarTree) => {
  const store = configureStore({ navBarTree });
  return render(<MegaMenu onClose={() => {}} />, { store });
};

describe('MegaMenu', () => {
  afterEach(() => {
    window.localStorage.clear();
    config.featureToggles = {};
    contextSrv.user.isSignedIn = false;
    contextSrv.isSignedIn = false;
  });
  it('should render component', async () => {
    setup();

    expect(await screen.findByTestId(selectors.components.NavMenu.Menu)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Section name' })).toBeInTheDocument();
  });

  it('should render children', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Expand section: Section name' }));
    expect(await screen.findByRole('link', { name: 'Child1' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Child2' })).toBeInTheDocument();
  });

  it('should render grandchildren', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Expand section: Section name' }));
    expect(await screen.findByRole('link', { name: 'Child1' })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Expand section: Child1' }));
    expect(await screen.findByRole('link', { name: 'Grandchild1' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Child2' })).toBeInTheDocument();
  });

  it('should filter out profile', async () => {
    setup();

    expect(screen.queryByLabelText('Profile')).not.toBeInTheDocument();
  });

  it('filters nav items by the saved job role preference', async () => {
    config.featureToggles.jobRoleNavPresets = true;
    contextSrv.user.isSignedIn = true;
    contextSrv.isSignedIn = true;
    server.use(
      http.get('/api/user/preferences', () =>
        HttpResponse.json({
          navbar: {
            bookmarkUrls: [],
            jobRole: 'data-analyst',
          },
        })
      ),
      http.get('/api/user/orgs', () => HttpResponse.json([]))
    );

    setup([
      { id: 'home', text: 'Home', url: '/' },
      { id: 'dashboards/browse', text: 'Dashboards', url: '/dashboards' },
      { id: 'explore', text: 'Explore', url: '/explore' },
      { id: 'alerting', text: 'Alerting', url: '/alerting' },
      { id: 'cfg', text: 'Administration', url: '/admin' },
    ]);

    expect(await screen.findByRole('link', { name: 'Explore' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Alerting' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Administration' })).not.toBeInTheDocument();
    });
  });

  it('does not show the full nav while the saved job role preference is loading', async () => {
    config.featureToggles.jobRoleNavPresets = true;
    contextSrv.user.isSignedIn = true;
    contextSrv.isSignedIn = true;
    server.use(
      http.get('/api/user/preferences', async () => {
        await delay('infinite');
        return HttpResponse.json({});
      }),
      http.get('/api/user/orgs', () => HttpResponse.json([]))
    );

    setup([
      { id: 'home', text: 'Home', url: '/' },
      { id: 'dashboards/browse', text: 'Dashboards', url: '/dashboards' },
      { id: 'explore', text: 'Explore', url: '/explore' },
      { id: 'alerting', text: 'Alerting', url: '/alerting' },
      { id: 'cfg', text: 'Administration', url: '/admin' },
    ]);

    expect(await screen.findByTestId(selectors.components.NavMenu.Menu)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Alerting' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Administration' })).not.toBeInTheDocument();
  });
});
