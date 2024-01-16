/* eslint-disable @typescript-eslint/no-explicit-any */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { FC } from 'react';

import { useApiCall } from './useApiCall';

const originalConsoleError = console.error;

const HookWrapper: FC<{ fn: () => any; apiFnArgs?: any; apiFnArgsRetry?: any; retryDefault?: boolean }> = ({
  fn,
  apiFnArgs,
  apiFnArgsRetry,
  retryDefault = true,
}) => {
  const [data, errorMessage, isLoading, apiCall] = useApiCall(fn, apiFnArgs, apiFnArgsRetry, retryDefault);

  return (
    <>
      {/* @ts-ignore */}
      <span data-testid="hook-wrapper-data">{data}</span>
      <span data-testid="hook-wrapper-error">
        {typeof errorMessage === 'string' ? errorMessage : (errorMessage as any).message}
      </span>
      {isLoading && <span data-testid="hook-wrapper-loading" />}
      <button data-testid="hook-wrapper-api" onClick={apiCall} />
    </>
  );
};

describe('useApiCall::', () => {
  beforeEach(() => {
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  const fakeData = 42;
  const fakeApi = jest.fn().mockImplementation(() => Promise.resolve(fakeData));
  const fakeApiInvalid = jest.fn().mockImplementation(() => {
    return Promise.resolve(null);
  });
  const fakeApiWithTimeout = jest.fn().mockImplementation(async () => {
    await new Promise(() => setTimeout(() => {}, 1000));

    return Promise.resolve(fakeData);
  });
  const fakeApiRetry = jest.fn().mockImplementation(async (value: number) => {
    if (value !== fakeData) {
      return Promise.reject();
    }

    return Promise.resolve(fakeData);
  });

  it('should return the correct values if the api call is pending', async () => {
    render(<HookWrapper fn={fakeApiWithTimeout} />);

    const data = screen.getByTestId('hook-wrapper-data').textContent;
    const errorMessage = screen.getByTestId('hook-wrapper-error').textContent;
    const isLoading = screen.getByTestId('hook-wrapper-loading');

    expect(data).toEqual('');
    expect(errorMessage).toEqual('');
    expect(isLoading).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('hook-wrapper-api'));

    expect(fakeApiWithTimeout).toBeCalledTimes(2);
  });

  it('should return the correct values if the api call has succeeded', async () => {
    render(<HookWrapper fn={fakeApi} />);

    await waitFor(() => screen.getByTestId('hook-wrapper-loading'));

    const data = screen.getByTestId('hook-wrapper-data').textContent;
    const errorMessage = screen.getByTestId('hook-wrapper-error').textContent;
    const isLoading = screen.queryByTestId('hook-wrapper-loading');

    expect(errorMessage).toEqual('');
    expect(parseInt(data || '', 10)).toEqual(fakeData);
    expect(isLoading).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('hook-wrapper-api'));

    expect(fakeApi).toBeCalledTimes(2);
  });

  it('should return the correct error if the api call has failed', async () => {
    render(<HookWrapper fn={fakeApiInvalid} retryDefault={false} />);

    await waitFor(() => screen.getByTestId('hook-wrapper-loading'));

    const data = screen.getByTestId('hook-wrapper-data').textContent;
    const errorMessage = screen.getByTestId('hook-wrapper-error').textContent;
    const isLoading = screen.queryByTestId('hook-wrapper-loading');

    expect(data).toBe('');
    expect(errorMessage).toEqual('Invalid response received');
    expect(isLoading).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('hook-wrapper-api'));

    expect(fakeApiInvalid).toBeCalledTimes(2);
  });

  it('should retry the call with different arguments if retry is true', async () => {
    render(<HookWrapper fn={fakeApiRetry} apiFnArgs={null} apiFnArgsRetry={fakeData} />);

    await waitFor(() => screen.getByTestId('hook-wrapper-loading'));

    const data = screen.getByTestId('hook-wrapper-data').textContent;
    const errorMessage = screen.getByTestId('hook-wrapper-error').textContent;
    const isLoading = screen.queryByTestId('hook-wrapper-loading');

    expect(data).toBe(fakeData.toString());
    expect(errorMessage).toEqual('');
    expect(isLoading).not.toBeInTheDocument();

    // called 2 times due to retry being enabled
    expect(fakeApiRetry).toBeCalledTimes(2);
  });
});
