import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { ComponentProps } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { TestProvider } from 'test/helpers/TestProvider';

import { selectors } from '@grafana/e2e-selectors';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';

import BrowseDashboardsPage, { Props } from './BrowseDashboardsPage';
import { wellFormedTree } from './fixtures/dashboardsTreeItem.fixture';
const [mockTree, { dashbdD }] = wellFormedTree();

jest.mock('react-virtualized-auto-sizer', () => {
  return {
    __esModule: true,
    default(props: ComponentProps<typeof AutoSizer>) {
      return <div>{props.children({ width: 800, height: 600 })}</div>;
    },
  };
});

function render(...[ui, options]: Parameters<typeof rtlRender>) {
  rtlRender(
    <TestProvider
      storeState={{
        navIndex: {
          'dashboards/browse': {
            text: 'Dashboards',
            id: 'dashboards/browse',
          },
        },
      }}
    >
      {ui}
    </TestProvider>,
    options
  );
}

jest.mock('app/features/search/service/folders', () => {
  return {
    getFolderChildren(parentUID?: string) {
      const childrenForUID = mockTree
        .filter((v) => v.item.kind !== 'ui-empty-folder' && v.item.parentUID === parentUID)
        .map((v) => v.item);

      return Promise.resolve(childrenForUID);
    },
  };
});

describe('browse-dashboards BrowseDashboardsPage', () => {
  let props: Props;

  beforeEach(() => {
    props = {
      ...getRouteComponentProps(),
    };
  });

  it('displays a search input', async () => {
    render(<BrowseDashboardsPage {...props} />);
    expect(await screen.findByPlaceholderText('Search box')).toBeInTheDocument();
  });

  it('displays the filters and hides the actions initially', async () => {
    render(<BrowseDashboardsPage {...props} />);

    expect(await screen.findByText('Sort')).toBeInTheDocument();
    expect(await screen.findByText('Filter by tag')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Move' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('selecting an item hides the filters and shows the actions instead', async () => {
    render(<BrowseDashboardsPage {...props} />);

    const checkbox = await screen.findByTestId(selectors.pages.BrowseDashbards.table.checkbox(dashbdD.item.uid));
    await userEvent.click(checkbox);

    // Check the filters are now hidden
    expect(screen.queryByText('Filter by tag')).not.toBeInTheDocument();
    expect(screen.queryByText('Sort')).not.toBeInTheDocument();

    // Check the actions are now visible
    expect(screen.getByRole('button', { name: 'Move' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });
});
