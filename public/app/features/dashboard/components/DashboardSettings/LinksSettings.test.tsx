import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { selectors } from '@grafana/e2e-selectors';

import { LinksSettings } from './LinksSettings';

describe('LinksSettings', () => {
  let dashboard = {};
  const links = [
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
  ];

  const getTableBody = () => screen.getAllByRole('rowgroup')[1];
  const getTableBodyRows = () => within(getTableBody()).getAllByRole('row');
  const assertRowHasText = (index: number, text: string) => {
    expect(within(getTableBodyRows()[index]).queryByText(text)).toBeInTheDocument();
  };

  beforeEach(() => {
    dashboard = {
      id: 74,
      version: 7,
      links: [...links],
    };
  });

  test('it renders a header and cta if no links', () => {
    const linklessDashboard = { ...dashboard, links: [] };
    // @ts-ignore
    render(<LinksSettings dashboard={linklessDashboard} />);

    expect(screen.getByRole('heading', { name: 'Dashboard links' })).toBeInTheDocument();
    expect(
      screen.getByLabelText(selectors.components.CallToActionCard.button('Add dashboard link'))
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  test('it renders a table of links', () => {
    // @ts-ignore
    render(<LinksSettings dashboard={dashboard} />);

    expect(getTableBodyRows().length).toBe(links.length);
    expect(
      screen.queryByLabelText(selectors.components.CallToActionCard.button('Add dashboard link'))
    ).not.toBeInTheDocument();
  });

  test('it rearranges the order of dashboard links', () => {
    // @ts-ignore
    render(<LinksSettings dashboard={dashboard} />);

    // Check that we have sorting buttons
    expect(within(getTableBodyRows()[0]).queryByRole('button', { name: 'arrow-up' })).not.toBeInTheDocument();
    expect(within(getTableBodyRows()[0]).queryByRole('button', { name: 'arrow-down' })).toBeInTheDocument();

    expect(within(getTableBodyRows()[1]).queryByRole('button', { name: 'arrow-up' })).toBeInTheDocument();
    expect(within(getTableBodyRows()[1]).queryByRole('button', { name: 'arrow-down' })).toBeInTheDocument();

    expect(within(getTableBodyRows()[2]).queryByRole('button', { name: 'arrow-up' })).toBeInTheDocument();
    expect(within(getTableBodyRows()[2]).queryByRole('button', { name: 'arrow-down' })).not.toBeInTheDocument();

    // Checking the original order
    assertRowHasText(0, links[0].title);
    assertRowHasText(1, links[1].title);
    assertRowHasText(2, links[2].url);

    userEvent.click(within(getTableBody()).getAllByRole('button', { name: 'arrow-down' })[0]);
    userEvent.click(within(getTableBody()).getAllByRole('button', { name: 'arrow-down' })[1]);
    userEvent.click(within(getTableBody()).getAllByRole('button', { name: 'arrow-up' })[0]);

    // Checking if it has changed the sorting accordingly
    assertRowHasText(0, links[2].url);
    assertRowHasText(1, links[1].title);
    assertRowHasText(2, links[0].title);
  });

  test('it duplicates dashboard links', () => {
    // @ts-ignore
    render(<LinksSettings dashboard={dashboard} />);

    expect(getTableBodyRows().length).toBe(links.length);

    userEvent.click(within(getTableBody()).getAllByRole('button', { name: /copy/i })[0]);

    expect(getTableBodyRows().length).toBe(links.length + 1);
    expect(within(getTableBody()).getAllByText(links[0].title).length).toBe(2);
  });

  test('it deletes dashboard links', () => {
    // @ts-ignore
    render(<LinksSettings dashboard={dashboard} />);

    expect(getTableBodyRows().length).toBe(links.length);

    userEvent.click(within(getTableBody()).getAllByRole('button', { name: /delete/i })[0]);

    expect(getTableBodyRows().length).toBe(links.length - 1);
    expect(within(getTableBody()).queryByText(links[0].title)).not.toBeInTheDocument();
  });

  test('it renders a form which modifies dashboard links', () => {
    // @ts-ignore
    render(<LinksSettings dashboard={dashboard} />);
    userEvent.click(screen.getByRole('button', { name: /new/i }));

    expect(screen.queryByText('Type')).toBeInTheDocument();
    expect(screen.queryByText('Title')).toBeInTheDocument();
    expect(screen.queryByText('With tags')).toBeInTheDocument();

    expect(screen.queryByText('Url')).not.toBeInTheDocument();
    expect(screen.queryByText('Tooltip')).not.toBeInTheDocument();
    expect(screen.queryByText('Icon')).not.toBeInTheDocument();

    userEvent.click(screen.getByText('Dashboards'));
    expect(screen.queryAllByText('Dashboards')).toHaveLength(2);
    expect(screen.queryByText('Link')).toBeVisible();

    userEvent.click(screen.getByText('Link'));

    expect(screen.queryByText('URL')).toBeInTheDocument();
    expect(screen.queryByText('Tooltip')).toBeInTheDocument();
    expect(screen.queryByText('Icon')).toBeInTheDocument();

    userEvent.clear(screen.getByRole('textbox', { name: /title/i }));
    userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'New Dashboard Link');
    userEvent.click(
      within(screen.getByRole('heading', { name: /dashboard links edit/i })).getByText(/dashboard links/i)
    );

    expect(getTableBodyRows().length).toBe(links.length + 1);
    expect(within(getTableBody()).queryByText('New Dashboard Link')).toBeInTheDocument();

    userEvent.click(screen.getAllByText(links[0].type)[0]);
    userEvent.clear(screen.getByRole('textbox', { name: /title/i }));
    userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'The first dashboard link');
    userEvent.click(
      within(screen.getByRole('heading', { name: /dashboard links edit/i })).getByText(/dashboard links/i)
    );

    expect(within(getTableBody()).queryByText(links[0].title)).not.toBeInTheDocument();
    expect(within(getTableBody()).queryByText('The first dashboard link')).toBeInTheDocument();
  });
});
