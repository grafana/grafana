import { render, screen } from 'test/test-utils';

import { NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { configureStore } from 'app/store/configureStore';

import { MegaMenu } from './MegaMenu';

const setup = () => {
  const navBarTree: NavModelItem[] = [
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

  fdescribe('mega menu controls', () => {
    describe('expand/collapse all sections', () => {
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
    });

    describe('filter menu items', () => {
      it('filters menu items', async () => {
        const { user } = setup();
        await user.type(await screen.findByPlaceholderText('Search menu'), 'Child1');
        expect(await screen.findByText('Child1')).toBeInTheDocument();
      });

      it('clears filter and shows all menu items', async () => {
        const { user } = setup();
        await user.type(await screen.findByPlaceholderText('Search menu'), 'Child1');

        await screen.findByText('Child1');

        await user.click(await screen.findByRole('button', { name: 'Clear filter' }));

        expect(await screen.findByText('Grandchild1')).toBeInTheDocument();
      });
    });
  });
});
