import React from 'react';
import { Alerts } from './Alerts';
import { AlertsService } from './Alerts.service';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('./Alerts.service');

describe('AlertsTable', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the table correctly', async () => {
    await waitFor(() => render(<Alerts />));

    expect(screen.getByTestId('table-thead').querySelectorAll('tr')).toHaveLength(1);
    expect(screen.getByTestId('table-tbody').querySelectorAll('tr')).toHaveLength(6);
    expect(screen.queryByTestId('table-no-data')).not.toBeInTheDocument();
  });

  it('should have table initially loading', async () => {
    const resultOfRender = render(<Alerts />);
    expect(screen.getByTestId('table-loading')).toBeInTheDocument();
    await waitFor(() => resultOfRender);
  });

  it('should render correctly without data', async () => {
    jest
      .spyOn(AlertsService, 'list')
      .mockReturnValueOnce(Promise.resolve({ alerts: [], totals: { total_items: 0, total_pages: 1 } }));
    await waitFor(() => render(<Alerts />));

    expect(screen.queryByTestId('table-thead')).not.toBeInTheDocument();
    expect(screen.queryByTestId('table-tbody')).not.toBeInTheDocument();
    expect(screen.getByTestId('table-no-data')).toBeInTheDocument();
  });
});
