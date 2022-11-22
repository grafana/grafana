import { within } from '@testing-library/dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { GrafanaContext } from 'app/core/context/GrafanaContext';

import { configureStore } from '../../../../store/configureStore';
import { DashboardModel } from '../../state/DashboardModel';
import { historySrv } from '../VersionHistory/HistorySrv';

import { VersionsSettings, VERSIONS_FETCH_LIMIT } from './VersionsSettings';
import { versions, diffs } from './__mocks__/versions';

jest.mock('../VersionHistory/HistorySrv');

const queryByFullText = (text: string) =>
  screen.queryByText((_, node: Element | undefined | null) => {
    if (node) {
      const nodeHasText = (node: HTMLElement | Element) => node.textContent?.includes(text);
      const currentNodeHasText = nodeHasText(node);
      const childrenDontHaveText = Array.from(node.children).every((child) => !nodeHasText(child));
      return Boolean(currentNodeHasText && childrenDontHaveText);
    }
    return false;
  });

function setup() {
  const store = configureStore();
  const dashboard = new DashboardModel({
    id: 74,
    version: 11,
    formatDate: jest.fn(() => 'date'),
    getRelativeTime: jest.fn(() => 'time ago'),
  });

  const sectionNav = {
    main: { text: 'Dashboard' },
    node: {
      text: 'Versions',
    },
  };

  return render(
    <GrafanaContext.Provider value={getGrafanaContextMock()}>
      <Provider store={store}>
        <BrowserRouter>
          <VersionsSettings sectionNav={sectionNav} dashboard={dashboard} />
        </BrowserRouter>
      </Provider>
    </GrafanaContext.Provider>
  );
}

describe('VersionSettings', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    // Need to use delay: null here to work with fakeTimers
    // see https://github.com/testing-library/user-event/issues/833
    user = userEvent.setup({ delay: null });
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders a header and a loading indicator followed by results in a table', async () => {
    // @ts-ignore
    historySrv.getHistoryList.mockResolvedValue(versions);
    setup();

    expect(screen.getByRole('heading', { name: /versions/i })).toBeInTheDocument();
    expect(screen.queryByText(/fetching history list/i)).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    const tableBodyRows = within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');

    expect(tableBodyRows.length).toBe(versions.length);

    const firstRow = within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row')[0];

    expect(within(firstRow).getByText(/latest/i)).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByText(/latest/i)).toHaveLength(1);
  });

  test('does not render buttons if versions === 1', async () => {
    // @ts-ignore
    historySrv.getHistoryList.mockResolvedValue(versions.slice(0, 1));
    setup();

    expect(screen.queryByRole('button', { name: /show more versions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /compare versions/i })).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: /show more versions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /compare versions/i })).not.toBeInTheDocument();
  });

  test('does not render show more button if versions < VERSIONS_FETCH_LIMIT', async () => {
    // @ts-ignore
    historySrv.getHistoryList.mockResolvedValue(versions.slice(0, VERSIONS_FETCH_LIMIT - 5));
    setup();

    expect(screen.queryByRole('button', { name: /show more versions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /compare versions/i })).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: /show more versions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /compare versions/i })).toBeInTheDocument();
  });

  test('renders buttons if versions >= VERSIONS_FETCH_LIMIT', async () => {
    // @ts-ignore
    historySrv.getHistoryList.mockResolvedValue(versions.slice(0, VERSIONS_FETCH_LIMIT));
    setup();

    expect(screen.queryByRole('button', { name: /show more versions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /compare versions/i })).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    const compareButton = screen.getByRole('button', { name: /compare versions/i });
    const showMoreButton = screen.getByRole('button', { name: /show more versions/i });

    expect(showMoreButton).toBeInTheDocument();
    expect(showMoreButton).toBeEnabled();

    expect(compareButton).toBeInTheDocument();
    expect(compareButton).toBeDisabled();
  });

  test('clicking show more appends results to the table', async () => {
    historySrv.getHistoryList
      // @ts-ignore
      .mockImplementationOnce(() => Promise.resolve(versions.slice(0, VERSIONS_FETCH_LIMIT)))
      .mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve(versions.slice(VERSIONS_FETCH_LIMIT)), 1000))
      );

    setup();

    expect(historySrv.getHistoryList).toBeCalledTimes(1);

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());

    expect(within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row').length).toBe(VERSIONS_FETCH_LIMIT);

    const showMoreButton = screen.getByRole('button', { name: /show more versions/i });
    await user.click(showMoreButton);

    expect(historySrv.getHistoryList).toBeCalledTimes(2);
    expect(screen.getByText(/Fetching more entries/i)).toBeInTheDocument();
    jest.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(screen.queryByText(/Fetching more entries/i)).not.toBeInTheDocument();
      expect(within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row').length).toBe(versions.length);
    });
  });

  test('selecting two versions and clicking compare button should render compare view', async () => {
    // @ts-ignore
    historySrv.getHistoryList.mockResolvedValue(versions.slice(0, VERSIONS_FETCH_LIMIT));
    historySrv.getDashboardVersion
      // @ts-ignore
      .mockImplementationOnce(() => Promise.resolve(diffs.lhs))
      .mockImplementationOnce(() => Promise.resolve(diffs.rhs));

    setup();

    expect(historySrv.getHistoryList).toBeCalledTimes(1);

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());

    const compareButton = screen.getByRole('button', { name: /compare versions/i });
    const tableBody = screen.getAllByRole('rowgroup')[1];
    await user.click(within(tableBody).getAllByRole('checkbox')[0]);
    await user.click(within(tableBody).getAllByRole('checkbox')[VERSIONS_FETCH_LIMIT - 1]);

    expect(compareButton).toBeEnabled();

    await user.click(compareButton);

    await waitFor(() => expect(screen.getByRole('heading', { name: /comparing 2 11/i })).toBeInTheDocument());

    expect(queryByFullText('Version 11 updated by admin')).toBeInTheDocument();
    expect(queryByFullText('Version 2 updated by admin')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /restore to version 2/i })).toBeInTheDocument();
    expect(screen.queryAllByTestId('diffGroup').length).toBe(5);

    const diffGroups = screen.getAllByTestId('diffGroup');

    expect(queryByFullText('description added The dashboard description')).toBeInTheDocument();
    expect(queryByFullText('panels changed')).toBeInTheDocument();
    expect(within(diffGroups[1]).queryByRole('list')).toBeInTheDocument();
    expect(within(diffGroups[1]).queryByText(/added title/i)).toBeInTheDocument();
    expect(within(diffGroups[1]).queryByText(/changed id/i)).toBeInTheDocument();
    expect(queryByFullText('tags deleted item 0')).toBeInTheDocument();
    expect(queryByFullText('timepicker added 1 refresh_intervals')).toBeInTheDocument();
    expect(queryByFullText('version changed')).toBeInTheDocument();
    expect(screen.queryByText(/view json diff/i)).toBeInTheDocument();

    await user.click(screen.getByText(/view json diff/i));

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
  });
});
