import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { type NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';

import { MegaMenu } from './MegaMenu';

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

const setup = (navBarTree: NavModelItem[] = defaultNavBarTree, customizableMegaMenu = false) => {
  config.featureToggles.customizableMegaMenu = customizableMegaMenu;
  const store = configureStore({ navBarTree });
  return render(<MegaMenu onClose={() => {}} />, { store });
};

const multiSectionTree: NavModelItem[] = [
  { text: 'Alpha', id: 'alpha', url: 'alpha' },
  { text: 'Bravo', id: 'bravo', url: 'bravo' },
  { text: 'Charlie', id: 'charlie', url: 'charlie' },
];

describe('MegaMenu', () => {
  afterEach(() => {
    window.localStorage.clear();
    config.featureToggles.customizableMegaMenu = true;
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

  it('should render show me more when customizable menu is enabled', async () => {
    setup(defaultNavBarTree, true);
    expect(await screen.findByText('Show me more')).toBeInTheDocument();
  });

  describe('section ordering', () => {
    const getSectionOrder = async () => {
      // ensure the menu has rendered before reading order
      await screen.findByRole('link', { name: 'Alpha' });
      return screen.getAllByRole('link').map((link) => link.textContent);
    };

    it('renders sections in the order saved in local storage', async () => {
      window.localStorage.setItem('grafana.navigation.sectionOrder', JSON.stringify(['charlie', 'alpha', 'bravo']));
      setup(multiSectionTree);

      expect(await getSectionOrder()).toEqual(['Charlie', 'Alpha', 'Bravo']);
    });

    it('appends sections missing from the saved order after the known ones', async () => {
      window.localStorage.setItem('grafana.navigation.sectionOrder', JSON.stringify(['bravo']));
      setup(multiSectionTree);

      expect(await getSectionOrder()).toEqual(['Bravo', 'Alpha', 'Charlie']);
    });

    it('renders the default order when nothing is saved', async () => {
      setup(multiSectionTree);

      expect(await getSectionOrder()).toEqual(['Alpha', 'Bravo', 'Charlie']);
    });

    it('exposes a drag handle for top-level sections but not for children', async () => {
      const { user } = setup();

      expect(await screen.findByLabelText('Reorder section: Section name')).toBeInTheDocument();

      await user.click(await screen.findByRole('button', { name: 'Expand section: Section name' }));
      await screen.findByRole('link', { name: 'Child1' });
      expect(screen.queryByLabelText('Reorder section: Child1')).not.toBeInTheDocument();
    });
  });
});
