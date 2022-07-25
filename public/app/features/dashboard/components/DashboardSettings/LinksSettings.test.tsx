import { within } from '@testing-library/dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

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
      screen.getByTestId(selectors.components.CallToActionCard.buttonV2('Add dashboard link'))
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  test('it renders a table of links', () => {
    // @ts-ignore
    render(<LinksSettings dashboard={dashboard} />);

    expect(getTableBodyRows().length).toBe(links.length);
    expect(
      screen.queryByTestId(selectors.components.CallToActionCard.buttonV2('Add dashboard link'))
    ).not.toBeInTheDocument();
  });

  test('it rearranges the order of dashboard links', async () => {
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

    await userEvent.click(within(getTableBody()).getAllByRole('button', { name: 'arrow-down' })[0]);
    await userEvent.click(within(getTableBody()).getAllByRole('button', { name: 'arrow-down' })[1]);
    await userEvent.click(within(getTableBody()).getAllByRole('button', { name: 'arrow-up' })[0]);

    // Checking if it has changed the sorting accordingly
    assertRowHasText(0, links[2].url);
    assertRowHasText(1, links[1].title);
    assertRowHasText(2, links[0].title);
  });

  test('it duplicates dashboard links', async () => {
    // @ts-ignore
    render(<LinksSettings dashboard={dashboard} />);

    expect(getTableBodyRows().length).toBe(links.length);

    await userEvent.click(within(getTableBody()).getAllByRole('button', { name: /copy/i })[0]);

    expect(getTableBodyRows().length).toBe(links.length + 1);
    expect(within(getTableBody()).getAllByText(links[0].title).length).toBe(2);
  });

  test('it deletes dashboard links', async () => {
    // @ts-ignore
    render(<LinksSettings dashboard={dashboard} />);

    expect(getTableBodyRows().length).toBe(links.length);

    await userEvent.click(within(getTableBody()).getAllByLabelText(/Delete link with title/)[0]);
    await userEvent.click(within(getTableBody()).getByRole('button', { name: 'Delete' }));

    expect(getTableBodyRows().length).toBe(links.length - 1);
    expect(within(getTableBody()).queryByText(links[0].title)).not.toBeInTheDocument();
  });

  test('it renders a form which modifies dashboard links', async () => {
    // @ts-ignore
    render(<LinksSettings dashboard={dashboard} />);
    await userEvent.click(screen.getByRole('button', { name: /new/i }));

    expect(screen.queryByText('Type')).toBeInTheDocument();
    expect(screen.queryByText('Title')).toBeInTheDocument();
    expect(screen.queryByText('With tags')).toBeInTheDocument();
    expect(screen.queryByText('Apply')).toBeInTheDocument();

    expect(screen.queryByText('Url')).not.toBeInTheDocument();
    expect(screen.queryByText('Tooltip')).not.toBeInTheDocument();
    expect(screen.queryByText('Icon')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Dashboards'));
    expect(screen.queryAllByText('Dashboards')).toHaveLength(2);
    expect(screen.queryByText('Link')).toBeVisible();

    await userEvent.click(screen.getByText('Link'));

    expect(screen.queryByText('URL')).toBeInTheDocument();
    expect(screen.queryByText('Tooltip')).toBeInTheDocument();
    expect(screen.queryByText('Icon')).toBeInTheDocument();

    await userEvent.clear(screen.getByRole('textbox', { name: /title/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'New Dashboard Link');
    await userEvent.click(
      within(screen.getByRole('heading', { name: /dashboard links edit/i })).getByText(/dashboard links/i)
    );

    expect(getTableBodyRows().length).toBe(links.length + 1);
    expect(within(getTableBody()).queryByText('New Dashboard Link')).toBeInTheDocument();

    await userEvent.click(screen.getAllByText(links[0].type)[0]);
    await userEvent.clear(screen.getByRole('textbox', { name: /title/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'The first dashboard link');
    await userEvent.click(
      within(screen.getByRole('heading', { name: /dashboard links edit/i })).getByText(/dashboard links/i)
    );

    expect(within(getTableBody()).queryByText(links[0].title)).not.toBeInTheDocument();
    expect(within(getTableBody()).queryByText('The first dashboard link')).toBeInTheDocument();
  });
});
