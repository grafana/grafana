import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { historySrv } from '../VersionHistory/HistorySrv';
import { VersionsSettings, VERSIONS_FETCH_LIMIT } from './VersionsSettings';
import { versions } from './__mocks__/versions';

jest.mock('../VersionHistory/HistorySrv');

describe('VersionSettings', () => {
  const dashboard: any = {
    id: 74,
    version: 7,
    formatDate: jest.fn(() => 'date'),
    getRelativeTime: jest.fn(() => 'time ago'),
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('renders a header and a loading indicator followed by results in a table', async () => {
    // @ts-ignore
    historySrv.getHistoryList.mockResolvedValue(versions);
    render(<VersionsSettings dashboard={dashboard} />);

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
    render(<VersionsSettings dashboard={dashboard} />);

    expect(screen.queryByRole('button', { name: /show more versions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /compare versions/i })).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: /show more versions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /compare versions/i })).not.toBeInTheDocument();
  });

  test('does not render show more button if versions < VERSIONS_FETCH_LIMIT', async () => {
    // @ts-ignore
    historySrv.getHistoryList.mockResolvedValue(versions.slice(0, VERSIONS_FETCH_LIMIT - 5));
    render(<VersionsSettings dashboard={dashboard} />);

    expect(screen.queryByRole('button', { name: /show more versions|/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /compare versions/i })).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: /show more versions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /compare versions/i })).toBeInTheDocument();
  });

  test('renders buttons if versions >= VERSIONS_FETCH_LIMIT', async () => {
    // @ts-ignore
    historySrv.getHistoryList.mockResolvedValue(versions.slice(0, VERSIONS_FETCH_LIMIT));
    render(<VersionsSettings dashboard={dashboard} />);

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
      .mockImplementationOnce(() => Promise.resolve(versions.slice(VERSIONS_FETCH_LIMIT, versions.length)));

    render(<VersionsSettings dashboard={dashboard} />);

    expect(historySrv.getHistoryList).toBeCalledTimes(1);

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());

    expect(within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row').length).toBe(VERSIONS_FETCH_LIMIT);

    const showMoreButton = screen.getByRole('button', { name: /show more versions/i });
    userEvent.click(showMoreButton);

    expect(historySrv.getHistoryList).toBeCalledTimes(2);
    expect(screen.queryByText(/Fetching more entries/i)).toBeInTheDocument();

    await waitFor(() =>
      expect(within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row').length).toBe(versions.length)
    );
  });

  test('selecting two versions and clicking compare button should render compare view', async () => {
    // @ts-ignore
    historySrv.getHistoryList.mockResolvedValue(versions.slice(0, VERSIONS_FETCH_LIMIT));
    // @ts-ignore
    historySrv.calculateDiff.mockResolvedValue('<div></div>');

    render(<VersionsSettings dashboard={dashboard} />);

    expect(historySrv.getHistoryList).toBeCalledTimes(1);

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());

    const compareButton = screen.getByRole('button', { name: /compare versions/i });
    const tableBody = screen.getAllByRole('rowgroup')[1];
    userEvent.click(within(tableBody).getAllByRole('checkbox')[1]);
    userEvent.click(within(tableBody).getAllByRole('checkbox')[4]);

    expect(compareButton).toBeEnabled();

    userEvent.click(within(tableBody).getAllByRole('checkbox')[0]);

    expect(compareButton).toBeDisabled();
    // TODO: currently blows up due to angularLoader.load would be nice to assert the header...
    // userEvent.click(compareButton);
    // expect(historySrv.calculateDiff).toBeCalledTimes(1);
    // await waitFor(() => expect(screen.getByTestId('angular-history-comparison')).toBeInTheDocument());
  });
});
