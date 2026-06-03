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

describe('MegaMenu simplified navigation', () => {
  const originalFlag = config.featureToggles.simplifiedNavigation;

  const simplifiedNavBarTree: NavModelItem[] = [
    { text: 'Home', id: 'home', url: '/' },
    { text: 'Dashboards', id: 'dashboards/browse', url: '/dashboards' },
    { text: 'Explore', id: 'explore', url: '/explore' },
    {
      text: 'Administration',
      id: 'cfg',
      url: '/admin',
      children: [{ text: 'Users', id: 'users', url: '/admin/users' }],
    },
  ];

  beforeEach(() => {
    config.featureToggles.simplifiedNavigation = true;
  });

  afterEach(() => {
    config.featureToggles.simplifiedNavigation = originalFlag;
    window.localStorage.clear();
  });

  it('shows only primary sections and tucks the rest behind "More"', async () => {
    setup(simplifiedNavBarTree);

    expect(await screen.findByRole('link', { name: 'Dashboards' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explore' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /more/i })).toBeInTheDocument();
    // secondary sections stay hidden until "More" is expanded
    expect(screen.queryByRole('link', { name: 'Administration' })).not.toBeInTheDocument();
  });

  it('reveals secondary sections when "More" is expanded', async () => {
    setup(simplifiedNavBarTree);

    await userEvent.click(await screen.findByRole('button', { name: /more/i }));
    expect(await screen.findByRole('link', { name: 'Administration' })).toBeInTheDocument();
  });

  it('does not group anything when the flag is off', async () => {
    config.featureToggles.simplifiedNavigation = false;
    setup(simplifiedNavBarTree);

    expect(await screen.findByRole('link', { name: 'Administration' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /more/i })).not.toBeInTheDocument();
  });
});
