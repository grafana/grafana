/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React, { FC } from 'react';

import { startUpdate } from '../UpdatePanel.service';

import { useInitializeUpdate } from './useInitializeUpdate';

const HookWrapper: FC = () => {
  const [authToken, logOffset, updateFailed, initializeUpdate] = useInitializeUpdate();

  return (
    <>
      <span data-testid="hook-wrapper-token">{authToken}</span>
      <span data-testid="hook-wrapper-offset">{logOffset}</span>
      {updateFailed && <span data-testid="hook-wrapper-update-failed" />}
      <button data-testid="hook-wrapper-update" onClick={initializeUpdate} />
    </>
  );
};

// NOTE (nicolalamacchia): this mock is here because some test cases alter it
jest.mock('../UpdatePanel.service', () => ({
  startUpdate: jest.fn(),
}));

const mockedStartUpdate = startUpdate as jest.Mock;
const originalConsoleError = jest.fn();

describe('useInitializeUpdate', () => {
  beforeEach(() => {
    // default mock
    mockedStartUpdate.mockImplementation(() => ({
      auth_token: 'test',
      log_offset: 1337,
    }));

    console.error = jest.fn();
  });

  afterEach(() => {
    mockedStartUpdate.mockRestore();
    console.error = originalConsoleError;
  });

  it('should return the correct values if the api call is pending', async () => {
    render(<HookWrapper />);

    expect(screen.getByTestId('hook-wrapper-token').textContent).toBe('');
    expect(screen.getByTestId('hook-wrapper-offset').textContent).toBe('0');
    expect(screen.queryByTestId('hook-wrapper-update-failed')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('hook-wrapper-update'));

    expect(mockedStartUpdate).toBeCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId('hook-wrapper-token').textContent).toBe('test'));
    await waitFor(() => expect(screen.getByTestId('hook-wrapper-offset').textContent).toBe('1337'));
    await waitFor(() => expect(screen.queryByTestId('hook-wrapper-update-failed')).not.toBeInTheDocument());
  });

  it('should return updateFailed equal to true if the the API call response was invalid', async () => {
    mockedStartUpdate.mockImplementation(() => null);

    render(<HookWrapper />);

    fireEvent.click(screen.getByTestId('hook-wrapper-update'));

    await waitFor(() => expect(screen.getByTestId('hook-wrapper-token').textContent).toBe(''));
    await waitFor(() => expect(screen.getByTestId('hook-wrapper-offset').textContent).toBe('0'));
    await waitFor(() => expect(screen.queryByTestId('hook-wrapper-update-failed')).toBeInTheDocument());
  });
});
