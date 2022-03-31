import React from 'react';
import { useSelector } from 'react-redux';
import { render, screen } from '@testing-library/react';
import EntitlementsPage from './EntitlementsPage';

jest.mock('react-redux', () => {
  const original = jest.requireActual('react-redux');
  return {
    ...original,
    useSelector: jest.fn(),
  };
});

describe('EntitlementsPage', () => {
  beforeEach(() => {
    (useSelector as jest.Mock).mockImplementation((callback) => {
      return callback({
        perconaUser: { isAuthorized: true, isConnectedToPortal: true },
        perconaSettings: { isLoading: false },
      });
    });
  });

  afterEach(() => {
    (useSelector as jest.Mock).mockClear();
  });

  it('renders PageWrapper', async () => {
    await render(<EntitlementsPage />);
    expect(screen.getByTestId('page-wrapper-entitlements')).toBeInTheDocument();
  });
});
