import { useLocation } from 'react-router-dom-v5-compat';
import { getWrapper, render, screen, userEvent } from 'test/test-utils';

import { NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { configureStore } from 'app/store/configureStore';

import { AppChromeService } from '../AppChromeService';

import { MegaMenu } from './MegaMenu';

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useLocation: jest.fn().mockReturnValue({ pathname: '/' }),
}));

const grandchild1 = { text: 'Grandchild1', id: 'grandchild1', url: 'section/child1/grandchild1' };

const child1 = {
  text: 'Child1',
  id: 'child1',
  url: 'section/child1',
  children: [grandchild1],
};

const child2 = { text: 'Child2', id: 'child2', url: 'section/child2' };

const navBarTree: NavModelItem[] = [
  {
    text: 'Section name',
    id: 'section',
    url: 'section',
    children: [child1, child2],
  },
  {
    text: 'Profile',
    id: 'profile',
    url: 'profile',
  },
];

const setup = (sectionNav?: NavModelItem) => {
  const chromeService = new AppChromeService();
  if (sectionNav) {
    // Megamenu matching has some special logic regarding URLs - we need to set to something other than `/`
    // otherwise the tests will always think we're on the home page
    // and we won't match the section correctly when checking for initial active items/expanded state
    (useLocation as jest.Mock).mockReturnValue({ pathname: sectionNav.url });
    chromeService.update({
      sectionNav: { node: sectionNav, main: { text: '' } },
    });
  }

  const store = configureStore({ navBarTree });

  const wrapper = getWrapper({
    renderWithRouter: true,
    grafanaContext: {
      chrome: chromeService,
    },
    store,
  });

  return render(<MegaMenu onClose={() => {}} />, {
    wrapper,
    preloadedState: { navBarTree },
  });
};

const getSearchInput = async () => screen.findByLabelText('Search menu');
const filterMegaMenu = async (filter: string) => {
  const user = userEvent.setup();
  return user.type(await getSearchInput(), filter);
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
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Expand section: Section name' }));
    expect(await screen.findByRole('link', { name: 'Child1' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Child2' })).toBeInTheDocument();
  });

  it('should render grandchildren', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Expand section: Section name' }));
    expect(await screen.findByRole('link', { name: 'Child1' })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Expand section: Child1' }));
    expect(await screen.findByRole('link', { name: 'Grandchild1' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Child2' })).toBeInTheDocument();
  });

  it('should filter out profile', async () => {
    setup();

    expect(screen.queryByLabelText('Profile')).not.toBeInTheDocument();
  });

  describe('mega menu controls', () => {
    describe('expand/collapse', () => {
      it('should expand and collapse all sections', async () => {
        const allExpectedChildItems = ['Child1', 'Grandchild1', 'Child2'];

        const { user } = setup();
        allExpectedChildItems.forEach((item) => {
          expect(screen.queryByText(item)).not.toBeInTheDocument();
        });

        await user.click(await screen.findByRole('button', { name: 'Expand all sections' }));

        allExpectedChildItems.forEach((item) => {
          expect(screen.getByText(item)).toBeInTheDocument();
        });

        await user.click(await screen.findByRole('button', { name: 'Collapse all sections' }));

        allExpectedChildItems.forEach((item) => {
          expect(screen.queryByText(item)).not.toBeInTheDocument();
        });
      });

      it('expand and collapses individual section', async () => {
        const { user } = setup();

        expect(screen.queryByText('Child1')).not.toBeInTheDocument();

        await user.click(await screen.findByRole('button', { name: 'Expand section: Section name' }));

        expect(screen.getByText('Child1')).toBeInTheDocument();

        await user.click(await screen.findByRole('button', { name: 'Collapse section: Section name' }));

        expect(screen.queryByText('Child1')).not.toBeInTheDocument();
      });

      it('starts with section expanded if a child is already expanded', async () => {
        setup(child1);

        expect(await screen.findByText('Child1')).toBeInTheDocument();
      });

      it('starts with section expanded if a nested child is already expanded', async () => {
        setup(grandchild1);

        expect(await screen.findByText('Grandchild1')).toBeInTheDocument();
      });
    });

    describe('filter menu items', () => {
      it('filters menu items', async () => {
        setup();

        await filterMegaMenu('Child1');

        expect(await screen.findByText('Child1')).toBeInTheDocument();
      });

      it('filters menu items with fuzzy search', async () => {
        setup();

        await filterMegaMenu('chld1');

        expect(await screen.findByText('Child1')).toBeInTheDocument();
      });

      it('clears filter and shows all menu items', async () => {
        const { user } = setup();

        await filterMegaMenu('Child1');
        await screen.findByText('Child1');
        await user.click(await screen.findByRole('button', { name: 'Clear filter' }));

        expect(await screen.findByText('Grandchild1')).toBeInTheDocument();
      });

      it('shows all items when filter is manually cleared', async () => {
        const { user } = setup();

        await filterMegaMenu('Child1');
        await screen.findByText('Child1');
        await user.clear(await getSearchInput());

        expect(await screen.findByText('Grandchild1')).toBeInTheDocument();
      });

      it('shows empty state when no results are found', async () => {
        setup();

        await filterMegaMenu('foo bar');

        expect(await screen.findByText('No results found')).toBeInTheDocument();
      });
    });
  });
});
