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

  beforeEach(() => {
    dashboard = {
      id: 74,
      version: 7,
      links: [...links],
      updateSubmenuVisibility: () => {},
    };
  });

  test('it renders a header and cta if no links', () => {
    const linklessDashboard = { ...dashboard, links: [] };
    // @ts-ignore
    render(<LinksSettings dashboard={linklessDashboard} />);

    expect(screen.getByRole('heading', { name: 'Dashboard Links' })).toBeInTheDocument();
    expect(
      screen.getByLabelText(selectors.components.CallToActionCard.button('Add Dashboard Link'))
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  test('it renders a table of links', () => {
    // @ts-ignore
    render(<LinksSettings dashboard={dashboard} />);

    const tableBodyRows = within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');

    expect(tableBodyRows.length).toBe(links.length);
    expect(
      screen.queryByLabelText(selectors.components.CallToActionCard.button('Add Dashboard Link'))
    ).not.toBeInTheDocument();
  });

  test('it rearranges the order of dashboard links', () => {
    // @ts-ignore
    render(<LinksSettings dashboard={dashboard} />);

    const tableBody = screen.getAllByRole('rowgroup')[1];
    const tableBodyRows = within(tableBody).getAllByRole('row');

    expect(within(tableBody).getAllByRole('button', { name: 'arrow-down' }).length).toBe(links.length - 1);
    expect(within(tableBody).getAllByRole('button', { name: 'arrow-up' }).length).toBe(links.length - 1);

    expect(within(tableBodyRows[0]).getByText(links[0].title)).toBeInTheDocument();
    expect(within(tableBodyRows[1]).getByText(links[1].title)).toBeInTheDocument();
    expect(within(tableBodyRows[2]).getByText(links[2].url)).toBeInTheDocument();

    userEvent.click(within(tableBody).getAllByRole('button', { name: 'arrow-down' })[0]);

    expect(within(tableBodyRows[0]).getByText(links[1].title)).toBeInTheDocument();
    expect(within(tableBodyRows[1]).getByText(links[0].title)).toBeInTheDocument();
    expect(within(tableBodyRows[2]).getByText(links[2].url)).toBeInTheDocument();

    userEvent.click(within(tableBody).getAllByRole('button', { name: 'arrow-down' })[1]);
    userEvent.click(within(tableBody).getAllByRole('button', { name: 'arrow-up' })[0]);

    expect(within(tableBodyRows[0]).getByText(links[2].url)).toBeInTheDocument();
    expect(within(tableBodyRows[1]).getByText(links[1].title)).toBeInTheDocument();
    expect(within(tableBodyRows[2]).getByText(links[0].title)).toBeInTheDocument();
  });

  test('it duplicates dashboard links', () => {
    // @ts-ignore
    render(<LinksSettings dashboard={dashboard} />);

    const tableBody = screen.getAllByRole('rowgroup')[1];

    expect(within(tableBody).getAllByRole('row').length).toBe(links.length);

    userEvent.click(within(tableBody).getAllByRole('button', { name: /copy/i })[0]);

    expect(within(tableBody).getAllByRole('row').length).toBe(links.length + 1);
    expect(within(tableBody).getAllByText(links[0].title).length).toBe(2);
  });

  test('it deletes dashboard links', () => {
    // @ts-ignore
    render(<LinksSettings dashboard={dashboard} />);

    const tableBody = screen.getAllByRole('rowgroup')[1];

    expect(within(tableBody).getAllByRole('row').length).toBe(links.length);

    userEvent.click(within(tableBody).getAllByRole('button', { name: /delete/i })[0]);

    expect(within(tableBody).getAllByRole('row').length).toBe(links.length - 1);
    expect(within(tableBody).queryByText(links[0].title)).not.toBeInTheDocument();
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

    expect(screen.queryByText('Url')).toBeInTheDocument();
    expect(screen.queryByText('Tooltip')).toBeInTheDocument();
    expect(screen.queryByText('Icon')).toBeInTheDocument();

    userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'New Dashboard Link');
    userEvent.click(screen.getByRole('button', { name: /add/i }));

    const tableBody = screen.getAllByRole('rowgroup')[1];

    expect(within(tableBody).getAllByRole('row').length).toBe(links.length + 1);
    expect(within(tableBody).queryByText('New Dashboard Link')).toBeInTheDocument();

    userEvent.click(screen.getAllByText(links[0].type)[0]);
    userEvent.clear(screen.getByRole('textbox', { name: /title/i }));
    userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'The first dashboard link');
    userEvent.click(screen.getByRole('button', { name: /update/i }));

    expect(within(screen.getAllByRole('rowgroup')[1]).queryByText(links[0].title)).not.toBeInTheDocument();
    expect(within(screen.getAllByRole('rowgroup')[1]).queryByText('The first dashboard link')).toBeInTheDocument();
  });
});
