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
});

describe('MegaMenu gcx terminal', () => {
  const originalFlag = config.featureToggles.simplifiedNavigation;

  afterEach(() => {
    config.featureToggles.simplifiedNavigation = originalFlag;
    window.localStorage.clear();
  });

  it('replaces the nav with the gcx terminal when the flag is on', async () => {
    config.featureToggles.simplifiedNavigation = true;
    setup();

    expect(await screen.findByTestId('gcx-terminal')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Section name' })).not.toBeInTheDocument();
  });

  it('renders the normal nav when the flag is off', async () => {
    config.featureToggles.simplifiedNavigation = false;
    setup();

    expect(await screen.findByRole('link', { name: 'Section name' })).toBeInTheDocument();
    expect(screen.queryByTestId('gcx-terminal')).not.toBeInTheDocument();
  });
});
