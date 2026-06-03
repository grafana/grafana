import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { type NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { configureStore } from 'app/store/configureStore';

import { MegaMenu } from './MegaMenu';
import { usePinnedItems } from './hooks';

jest.mock('./hooks', () => ({
  usePinnedItems: jest.fn(() => []),
}));

const mockUsePinnedItems = jest.mocked(usePinnedItems);

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

  describe('empty Starred and Bookmarks sections', () => {
    beforeEach(() => {
      mockUsePinnedItems.mockReturnValue([]);
    });

    it('hides the Starred section when it has no children', async () => {
      setup([
        ...defaultNavBarTree,
        { text: 'Starred', id: 'starred', url: '/dashboards?starred', children: [], emptyMessage: 'No stars' },
      ]);

      expect(await screen.findByRole('link', { name: 'Section name' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Starred' })).not.toBeInTheDocument();
    });

    it('renders the Starred section when it has children', async () => {
      setup([
        ...defaultNavBarTree,
        {
          text: 'Starred',
          id: 'starred',
          url: '/dashboards?starred',
          emptyMessage: 'No stars',
          children: [{ text: 'My starred dashboard', id: 'starred-dash', url: '/d/abc' }],
        },
      ]);

      expect(await screen.findByRole('link', { name: 'Starred' })).toBeInTheDocument();
    });

    it('hides the Bookmarks section when there are no pinned items', async () => {
      mockUsePinnedItems.mockReturnValue([]);
      setup([
        ...defaultNavBarTree,
        { text: 'Bookmarks', id: 'bookmarks', url: '/bookmarks', children: [], emptyMessage: 'No bookmarks' },
      ]);

      expect(await screen.findByRole('link', { name: 'Section name' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Bookmarks' })).not.toBeInTheDocument();
    });

    it('renders the Bookmarks section when there are pinned items', async () => {
      mockUsePinnedItems.mockReturnValue(['section/child2']);
      setup([
        ...defaultNavBarTree,
        { text: 'Bookmarks', id: 'bookmarks', url: '/bookmarks', children: [], emptyMessage: 'No bookmarks' },
      ]);

      expect(await screen.findByRole('link', { name: 'Bookmarks' })).toBeInTheDocument();
    });
  });
});
