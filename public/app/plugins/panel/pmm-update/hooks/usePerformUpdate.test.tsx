/* eslint-disable @typescript-eslint/no-explicit-any */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React, { FC } from 'react';
import { act } from 'react-dom/test-utils';

import { getUpdateStatus } from '../UpdatePanel.service';
import { useInitializeUpdate, usePerformUpdate } from '../hooks';

const fakeLaunchUpdate = jest.fn();

const HookWrapper: FC = () => {
  const [output, errorMessage, isUpdated, updateFailed, launchUpdate] = usePerformUpdate();

  return (
    <>
      <span data-testid="hook-wrapper-output">{output}</span>
      <span data-testid="hook-wrapper-error">{errorMessage}</span>
      {isUpdated && <span data-testid="hook-wrapper-updated" />}
      {updateFailed && <span data-testid="hook-wrapper-update-failed" />}
      <button data-testid="hook-wrapper-update" onClick={launchUpdate} />
    </>
  );
};

// NOTE (nicolalamacchia): these mocks are here because some test cases alter them
jest.mock('./useInitializeUpdate', () => ({
  useInitializeUpdate: jest.fn(),
}));
const mockedUseInitializeUpdate = useInitializeUpdate as jest.Mock;

jest.mock('../UpdatePanel.service', () => ({
  getUpdateStatus: jest.fn(),
}));
const mockedGetUpdateStatus = getUpdateStatus as jest.Mock;

describe('usePerformUpdate', () => {
  beforeEach(() => {
    // default mocks
    mockedUseInitializeUpdate.mockImplementation(() => ['authToken', 0, false, fakeLaunchUpdate]);
    mockedGetUpdateStatus.mockImplementation(() => ({
      done: false,
      log_offset: 0,
      log_lines: ['test'],
    }));
  });

  afterEach(() => {
    mockedUseInitializeUpdate.mockRestore();
    mockedGetUpdateStatus.mockRestore();
  });

  it('should return the correct values if the upgrade initialization was successful', async () => {
    render(<HookWrapper />);

    await waitFor(() => expect(screen.getByTestId('hook-wrapper-output').textContent).toBe('test\n'));
    await waitFor(() => expect(screen.getByTestId('hook-wrapper-error').textContent).toBe(''));
    await waitFor(() => expect(screen.queryByTestId('hook-wrapper-updated')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByTestId('hook-wrapper-update-failed')).not.toBeInTheDocument());

    fireEvent.click(screen.getByTestId('hook-wrapper-update'));

    expect(fakeLaunchUpdate).toBeCalledTimes(1);
  });

  it('should return updateFailed equal to true if the initialization failed', async () => {
    mockedUseInitializeUpdate.mockImplementation(() => ['authToken', 0, true, fakeLaunchUpdate]);
    render(<HookWrapper />);

    await waitFor(() => expect(screen.getByTestId('hook-wrapper-output').textContent).toBe(''));
    await waitFor(() => expect(screen.getByTestId('hook-wrapper-error').textContent).toBe(''));
    await waitFor(() => expect(screen.queryByTestId('hook-wrapper-updated')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByTestId('hook-wrapper-update-failed')).toBeInTheDocument());
  });

  it('should return isUpdated equal to true if the upgrade succeeded', async () => {
    (getUpdateStatus as jest.Mock).mockImplementation(() => ({
      done: true,
      log_offset: 0,
      log_lines: ['test'],
    }));

    jest.useFakeTimers();

    render(<HookWrapper />);

    await act(async () => {
      jest.runAllTimers();
    });

    await waitFor(() => expect(screen.getByTestId('hook-wrapper-output').textContent).toBe('test\n'));
    await waitFor(() => expect(screen.getByTestId('hook-wrapper-error').textContent).toBe(''));
    await waitFor(() => expect(screen.queryByTestId('hook-wrapper-updated')).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByTestId('hook-wrapper-update-failed')).not.toBeInTheDocument());

    jest.useRealTimers();
  });

  it('should return an error message if the API call response is invalid', async () => {
    (getUpdateStatus as jest.Mock).mockImplementation(() => {});

    render(<HookWrapper />);

    await waitFor(() => expect(screen.getByTestId('hook-wrapper-output').textContent).toBe(''));
    await waitFor(() => expect(screen.getByTestId('hook-wrapper-error').textContent).toBe('Invalid response received'));
    await waitFor(() => expect(screen.queryByTestId('hook-wrapper-updated')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByTestId('hook-wrapper-update-failed')).not.toBeInTheDocument());
  });

  it('should increase logOffset value only with values received from server', async () => {
    const mockedGetUpdateStatus = getUpdateStatus as jest.Mock;

    mockedGetUpdateStatus
      .mockImplementationOnce(() => ({
        done: false,
        log_offset: 1500,
        log_lines: ['test'],
      }))
      .mockImplementationOnce(() => ({
        done: false,
        log_offset: 3000,
        log_lines: ['test'],
      }))
      .mockImplementationOnce(() => ({
        done: false,
        log_offset: 6000,
        log_lines: ['test'],
      }));

    jest.useFakeTimers();

    render(<HookWrapper />);

    await act(async () => {
      jest.runAllTimers();
    });

    await act(async () => {
      jest.runAllTimers();
    });

    await waitFor(() => expect(screen.getByTestId('hook-wrapper-output').textContent).toBe('test\ntest\ntest\n'));
    await waitFor(() => expect(screen.getByTestId('hook-wrapper-error').textContent).toBe(''));
    await waitFor(() => expect(screen.queryByTestId('hook-wrapper-updated')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByTestId('hook-wrapper-update-failed')).not.toBeInTheDocument());

    jest.useRealTimers();
  });
});
