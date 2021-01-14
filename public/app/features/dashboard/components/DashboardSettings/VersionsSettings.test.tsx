import React from 'react';
import '@testing-library/jest-dom';
import { historySrv } from '../VersionHistory/HistorySrv';
import { render, screen, waitFor, queryByText, getByTestId } from '@testing-library/react';
import { queryByTestId, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { VersionsSettings } from './VersionsSettings';
import { versions } from './__mocks__/versions';
import { DashboardModel } from '../../state';

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

  test('renders a loading indicator', () => {
    // @ts-ignore
    historySrv.getHistoryList.mockResolvedValue(versions);
    render(<VersionsSettings dashboard={dashboard} />);
    expect(screen.queryByText(/fetching history list/i)).toBeInTheDocument();
  });

  test('renders a table row for each version', async () => {
    // @ts-ignore
    historySrv.getHistoryList.mockResolvedValue(versions);
    render(<VersionsSettings dashboard={dashboard} />);
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    expect(within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row').length).toBe(versions.length);
  });

  test('only renders compare button if versions > 1', async () => {
    // @ts-ignore
    historySrv.getHistoryList.mockResolvedValue(versions.slice(0, 1));
    render(<VersionsSettings dashboard={dashboard} />);
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /compare versions/i })).not.toBeInTheDocument();
  });
});
