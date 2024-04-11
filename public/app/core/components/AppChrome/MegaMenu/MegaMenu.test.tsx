import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from 'history';
import React from 'react';
import { Router } from 'react-router-dom';
import { TestProvider } from 'test/helpers/TestProvider';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { MegaMenu } from './MegaMenu';

const setup = (initialUrl?: string) => {
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
    {
      id: 'starred',
      text: 'Starred',
      url: '/dashboards?starred',
      children: [
        {
          id: 'starred/someuid',
          text: 'Starred Dashboard',
          url: '/d/someuid/somename',
        },
      ],
    },
    {
      id: 'dashboards/browse',
      text: 'Dashboards',
      url: '/dashboards',
    },
  ];

  const grafanaContext = getGrafanaContextMock();
  grafanaContext.chrome.setMegaMenuOpen(true);

  const history = createMemoryHistory();
  if (initialUrl) {
    history.push(initialUrl);
  }

  return render(
    <TestProvider storeState={{ navBarTree }} grafanaContext={grafanaContext}>
      <Router history={history}>
        <MegaMenu onClose={() => {}} />
      </Router>
    </TestProvider>
  );
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
    await userEvent.click(await screen.findByRole('button', { name: 'Expand section Section name' }));
    expect(await screen.findByRole('link', { name: 'Child1' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Child2' })).toBeInTheDocument();
  });

  it('should render grandchildren', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Expand section Section name' }));
    expect(await screen.findByRole('link', { name: 'Child1' })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Expand section Child1' }));
    expect(await screen.findByRole('link', { name: 'Grandchild1' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Child2' })).toBeInTheDocument();
  });

  it('should filter out profile', async () => {
    setup();

    expect(screen.queryByLabelText('Profile')).not.toBeInTheDocument();
  });

  it('handles special case for starred dashboard', async () => {
    setup('/d/someuid/a-dashboard-name');

    const currentLink = await screen.findByRole('link', { current: 'page' });
    expect(currentLink.textContent).toEqual('Starred Dashboard');
  });
});
