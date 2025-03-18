import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { DashboardModel } from '../../state/DashboardModel';
import { createDashboardModelFixture } from '../../state/__fixtures__/dashboardFixtures';

import { DashboardSettings } from './DashboardSettings';

function setup(dashboard: DashboardModel) {
  const sectionNav = {
    main: { text: 'Dashboard' },
    node: {
      text: 'Links',
    },
  };

  // Need to use DashboardSettings here as it's responsible for fetching the state back from location
  return render(
    <DashboardSettings editview="links" dashboard={dashboard} sectionNav={sectionNav} pageNav={sectionNav.node} />
  );
}

function buildTestDashboard() {
  return createDashboardModelFixture({
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
  });
}

describe('LinksSettings', () => {
  const getTableBody = () => screen.getAllByRole('rowgroup')[1];
  const getTableBodyRows = () => within(getTableBody()).getAllByRole('row');
  const assertRowHasText = (index: number, text: string) => {
    expect(within(getTableBodyRows()[index]).queryByText(text)).toBeInTheDocument();
  };

  test('it renders a header and cta if no links', () => {
    const linklessDashboard = createDashboardModelFixture({ links: [] });
    setup(linklessDashboard);

    const linksTab = screen.getByRole('tab', { name: 'Links' });
    expect(linksTab).toBeInTheDocument();
    expect(linksTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Add dashboard link' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  test('it renders a table of links', () => {
    const dashboard = buildTestDashboard();
    setup(dashboard);

    expect(getTableBodyRows().length).toBe(dashboard.links.length);
    expect(screen.queryByRole('button', { name: 'Add dashboard link' })).not.toBeInTheDocument();
  });

  test('it rearranges the order of dashboard links', async () => {
    const dashboard = buildTestDashboard();
    const links = dashboard.links;
    setup(dashboard);

    // Check that we have sorting buttons
    expect(within(getTableBodyRows()[0]).queryByRole('button', { name: 'Move link up' })).not.toBeInTheDocument();
    expect(within(getTableBodyRows()[0]).queryByRole('button', { name: 'Move link down' })).toBeInTheDocument();

    expect(within(getTableBodyRows()[1]).queryByRole('button', { name: 'Move link up' })).toBeInTheDocument();
    expect(within(getTableBodyRows()[1]).queryByRole('button', { name: 'Move link down' })).toBeInTheDocument();

    expect(within(getTableBodyRows()[2]).queryByRole('button', { name: 'Move link up' })).toBeInTheDocument();
    expect(within(getTableBodyRows()[2]).queryByRole('button', { name: 'Move link down' })).not.toBeInTheDocument();

    // Checking the original order
    assertRowHasText(0, links[0].title);
    assertRowHasText(1, links[1].title);
    assertRowHasText(2, links[2].url!);

    await userEvent.click(within(getTableBody()).getAllByRole('button', { name: 'Move link down' })[0]);
    await userEvent.click(within(getTableBody()).getAllByRole('button', { name: 'Move link down' })[1]);
    await userEvent.click(within(getTableBody()).getAllByRole('button', { name: 'Move link up' })[0]);

    // Checking if it has changed the sorting accordingly
    assertRowHasText(0, links[2].url!);
    assertRowHasText(1, links[1].title);
    assertRowHasText(2, links[0].title);
  });

  test('it duplicates dashboard links', async () => {
    const dashboard = buildTestDashboard();
    setup(dashboard);

    expect(getTableBodyRows().length).toBe(dashboard.links.length);

    await userEvent.click(within(getTableBody()).getAllByRole('button', { name: /copy/i })[0]);

    expect(getTableBodyRows().length).toBe(4);
    expect(within(getTableBody()).getAllByText(dashboard.links[0].title).length).toBe(2);
  });

  test('it deletes dashboard links', async () => {
    const dashboard = buildTestDashboard();
    const originalLinks = dashboard.links;
    setup(dashboard);

    expect(getTableBodyRows().length).toBe(dashboard.links.length);

    await userEvent.click(within(getTableBody()).getAllByLabelText(/Delete link with title/)[0]);
    await userEvent.click(within(getTableBody()).getByRole('button', { name: 'Delete' }));

    expect(getTableBodyRows().length).toBe(2);
    expect(within(getTableBody()).queryByText(originalLinks[0].title)).not.toBeInTheDocument();
  });

  test('it renders a form which modifies dashboard links', async () => {
    const dashboard = buildTestDashboard();
    const originalLinks = dashboard.links;
    setup(dashboard);

    await userEvent.click(screen.getByRole('button', { name: /new/i }));

    expect(screen.queryByText('Type')).toBeInTheDocument();
    expect(screen.queryByText('Title')).toBeInTheDocument();
    expect(screen.queryByText('With tags')).toBeInTheDocument();
    expect(screen.queryByText('Back to list')).toBeInTheDocument();

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

    await userEvent.click(screen.getByRole('button', { name: /Back to list/i }));

    expect(getTableBodyRows().length).toBe(4);
    expect(within(getTableBody()).queryByText('New Dashboard Link')).toBeInTheDocument();

    await userEvent.click(screen.getAllByText(dashboard.links[0].type)[0]);
    await userEvent.clear(screen.getByRole('textbox', { name: /title/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'The first dashboard link');

    await userEvent.click(screen.getByRole('button', { name: /Back to list/i }));

    expect(within(getTableBody()).queryByText(originalLinks[0].title)).not.toBeInTheDocument();
    expect(within(getTableBody()).queryByText('The first dashboard link')).toBeInTheDocument();
  });
});
