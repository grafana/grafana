import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { LinksSettings } from './LinksSettings';

describe('LinksSettings', () => {
  let dashboard = {
    id: 74,
    version: 7,
    links: [
      {
        asDropdown: false,
        icon: 'external link',
        includeVars: false,
        keepTime: false,
        tags: [],
        targetBlank: false,
        title: 'link 1',
        tooltip: '',
        type: 'link',
        url: 'https://www.google.com',
      },
      {
        asDropdown: false,
        icon: 'external link',
        includeVars: false,
        keepTime: false,
        tags: ['gdev'],
        targetBlank: false,
        title: 'link 2',
        tooltip: '',
        type: 'dashboards',
        url: '',
      },
      {
        asDropdown: false,
        icon: 'external link',
        includeVars: false,
        keepTime: false,
        tags: [],
        targetBlank: false,
        title: '',
        tooltip: '',
        type: 'link',
        url: 'https://www.bing.com',
      },
    ],
    updateSubmenuVisibility: jest.fn(),
  };
  beforeEach(() => {
    jest.resetAllMocks();
  });
  test('it renders a header and cta if no links', () => {
    const linklessDashboard = { ...dashboard, links: [] };
    // @ts-ignore
    render(<LinksSettings dashboard={linklessDashboard} />);

    expect(screen.getByRole('heading', { name: 'Dashboard Links' })).toBeInTheDocument();
    expect(screen.getByLabelText('Call to action button Add Dashboard Link')).toBeInTheDocument();
  });
  test('it renders a table of links', () => {
    // @ts-ignore
    render(<LinksSettings dashboard={dashboard} />);

    const tableBodyRows = within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');

    expect(tableBodyRows.length).toBe(dashboard.links.length);
  });
  test('it rearranges the order of dashboard links', () => {
    // @ts-ignore
    render(<LinksSettings dashboard={dashboard} />);

    const tableBody = screen.getAllByRole('rowgroup')[1];
    const tableBodyRows = within(tableBody).getAllByRole('row');

    expect(within(tableBody).getAllByRole('button', { name: 'arrow-down' }).length).toBe(dashboard.links.length - 1);
    expect(within(tableBody).getAllByRole('button', { name: 'arrow-up' }).length).toBe(dashboard.links.length - 1);

    expect(within(tableBodyRows[0]).getByText('link 1')).toBeInTheDocument();
    expect(within(tableBodyRows[1]).getByText('link 2')).toBeInTheDocument();
    expect(within(tableBodyRows[2]).getByText('https://www.bing.com')).toBeInTheDocument();

    userEvent.click(within(tableBody).getAllByRole('button', { name: 'arrow-down' })[0]);

    expect(within(tableBodyRows[0]).getByText('link 2')).toBeInTheDocument();
    expect(within(tableBodyRows[1]).getByText('link 1')).toBeInTheDocument();
    expect(within(tableBodyRows[2]).getByText('https://www.bing.com')).toBeInTheDocument();

    userEvent.click(within(tableBody).getAllByRole('button', { name: 'arrow-down' })[1]);
    userEvent.click(within(tableBody).getAllByRole('button', { name: 'arrow-up' })[0]);

    expect(within(tableBodyRows[0]).getByText('https://www.bing.com')).toBeInTheDocument();
    expect(within(tableBodyRows[1]).getByText('link 2')).toBeInTheDocument();
    expect(within(tableBodyRows[2]).getByText('link 1')).toBeInTheDocument();
  });
});
