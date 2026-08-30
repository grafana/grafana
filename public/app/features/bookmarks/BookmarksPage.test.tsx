import { render, screen } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { setMockUserPreferences } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';

import { BookmarksPage } from './BookmarksPage';

setBackendSrv(backendSrv);
setupMockServer();

const originalIsSignedIn = contextSrv.user.isSignedIn;

beforeAll(() => {
  // The preferences query (where bookmarks are stored) is skipped for anonymous users
  contextSrv.user.isSignedIn = true;
});

afterAll(() => {
  contextSrv.user.isSignedIn = originalIsSignedIn;
});

function setup() {
  return render(<BookmarksPage />, {
    preloadedState: {
      navIndex: {
        bookmarks: { id: 'bookmarks', text: 'Bookmarks', url: '/bookmarks' },
      },
      navBarTree: [
        { id: 'dashboards', text: 'Dashboards', url: '/dashboards', subTitle: 'Browse dashboards' },
        { id: 'explore', text: 'Explore', url: '/explore' },
      ],
    },
  });
}

describe('BookmarksPage', () => {
  it('shows the empty state when the user has no bookmarks', async () => {
    setup();

    expect(await screen.findByText('It looks like you haven’t created any bookmarks yet')).toBeInTheDocument();
  });

  it('renders a card for each bookmarked nav item', async () => {
    setMockUserPreferences({ navbar: { bookmarkUrls: ['/dashboards', '/explore'] } });
    setup();

    expect(await screen.findByRole('link', { name: /Dashboards/ })).toHaveAttribute('href', '/dashboards');
    expect(screen.getByRole('link', { name: /Explore/ })).toHaveAttribute('href', '/explore');
    expect(screen.queryByText('It looks like you haven’t created any bookmarks yet')).not.toBeInTheDocument();
  });

  it('filters out bookmarks that no longer resolve to a nav item', async () => {
    setMockUserPreferences({ navbar: { bookmarkUrls: ['/dashboards', '/plugin-no-longer-installed'] } });
    setup();

    expect(await screen.findByRole('link', { name: /Dashboards/ })).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('shows the empty state when no bookmarks resolve to a nav item', async () => {
    setMockUserPreferences({ navbar: { bookmarkUrls: ['/plugin-no-longer-installed'] } });
    setup();

    expect(await screen.findByText('It looks like you haven’t created any bookmarks yet')).toBeInTheDocument();
  });
});
