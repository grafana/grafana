import React from 'react';
import { useSelector } from 'react-redux';
import { render, screen } from '@testing-library/react';
import TicketsPage from './TicketsPage';

jest.mock('react-redux', () => {
  const original = jest.requireActual('react-redux');
  return {
    ...original,
    useSelector: jest.fn(),
  };
});

describe('TicketsPage', () => {
  beforeEach(() => {
    (useSelector as jest.Mock).mockImplementation((callback) => {
      return callback({
        perconaUser: { isAuthorized: true },
        perconaSettings: { isLoading: false, isConnectedToPortal: true },
      });
    });
  });

  afterEach(() => {
    (useSelector as jest.Mock).mockClear();
  });

  it('renders PageWrapper', async () => {
    await render(<TicketsPage />);
    expect(screen.getByTestId('page-wrapper-tickets')).toBeInTheDocument();
  });
});
