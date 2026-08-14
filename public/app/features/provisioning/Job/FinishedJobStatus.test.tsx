import { type ReactElement } from 'react';
import { act, render } from 'test/test-utils';

import { useGetRepositoryJobsWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';

import { FinishedJobStatus } from './FinishedJobStatus';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  ...jest.requireActual('app/api/clients/provisioning/v0alpha1'),
  useGetRepositoryJobsWithPathQuery: jest.fn(),
}));

// The retry logic under test lives entirely in FinishedJobStatus; JobContent renders
// its own subtree (RTK hooks, theme) and would also emit onStatusChange, so stub it.
jest.mock('./JobContent', () => ({
  JobContent: () => null,
}));

const mockUseGetRepositoryJobsWithPathQuery = useGetRepositoryJobsWithPathQuery as unknown as jest.Mock;

const NO_JOB_FOUND_ERROR = expect.objectContaining({
  status: 'error',
  error: expect.objectContaining({ title: 'No job found' }),
});

function errorResult(refetch: jest.Mock) {
  return { data: undefined, isError: true, isFetching: false, isSuccess: false, isLoading: false, refetch };
}

function fetchingResult(refetch: jest.Mock) {
  return { data: undefined, isError: false, isFetching: true, isSuccess: false, isLoading: false, refetch };
}

function successResult(refetch: jest.Mock) {
  return {
    data: { status: { state: 'success' } },
    isError: false,
    isFetching: false,
    isSuccess: true,
    isLoading: false,
    refetch,
  };
}

describe('FinishedJobStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const element = (onStatusChange: jest.Mock) => (
    <FinishedJobStatus jobUid="job-uid" repositoryName="test-repo" jobType="delete" onStatusChange={onStatusChange} />
  );

  // Advance past the retry delay, then re-render with a freshly-settled query result so the
  // effect re-runs (RTK Query returns a new object identity on each settle).
  const settleWith = (rerender: (ui: ReactElement) => void, onStatusChange: jest.Mock, result: object) => {
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    mockUseGetRepositoryJobsWithPathQuery.mockReturnValue(result);
    rerender(element(onStatusChange));
  };

  it('retries up to the cap and then reports "No job found"', () => {
    const refetch = jest.fn();
    const onStatusChange = jest.fn();
    mockUseGetRepositoryJobsWithPathQuery.mockReturnValue(errorResult(refetch));

    const { rerender } = render(element(onStatusChange));

    // Four settled-error polls: still under the cap of 5, so no error yet.
    for (let i = 0; i < 4; i++) {
      settleWith(rerender, onStatusChange, errorResult(refetch));
    }

    expect(refetch).toHaveBeenCalledTimes(4);
    expect(onStatusChange).not.toHaveBeenCalledWith(NO_JOB_FOUND_ERROR);

    // Fifth poll fires and settles as an error -> cap reached, error surfaced once.
    settleWith(rerender, onStatusChange, errorResult(refetch));

    expect(refetch).toHaveBeenCalledTimes(5);
    expect(onStatusChange).toHaveBeenCalledWith(NO_JOB_FOUND_ERROR);
    const noJobFoundCalls = onStatusChange.mock.calls.filter((call) => call[0]?.error?.title === 'No job found');
    expect(noJobFoundCalls).toHaveLength(1);
  });

  it('recovers when a later poll succeeds and never reports "No job found"', () => {
    const refetch = jest.fn();
    const onStatusChange = jest.fn();
    mockUseGetRepositoryJobsWithPathQuery.mockReturnValue(errorResult(refetch));

    const { rerender } = render(element(onStatusChange));

    // Two failed polls, then the third poll returns the finished job.
    settleWith(rerender, onStatusChange, errorResult(refetch));
    settleWith(rerender, onStatusChange, errorResult(refetch));
    settleWith(rerender, onStatusChange, successResult(refetch));

    expect(onStatusChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
    expect(onStatusChange).not.toHaveBeenCalledWith(NO_JOB_FOUND_ERROR);
  });

  it('schedules exactly one retry per real settle across the armed and in-flight windows', () => {
    const refetch = jest.fn();
    const onStatusChange = jest.fn();
    mockUseGetRepositoryJobsWithPathQuery.mockReturnValue(errorResult(refetch));

    const { rerender } = render(element(onStatusChange));

    // Re-render while a retry timer is armed: the pending-timer guard blocks re-scheduling.
    mockUseGetRepositoryJobsWithPathQuery.mockReturnValue(errorResult(refetch));
    rerender(element(onStatusChange));
    mockUseGetRepositoryJobsWithPathQuery.mockReturnValue(errorResult(refetch));
    rerender(element(onStatusChange));

    // First armed timer fires.
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(refetch).toHaveBeenCalledTimes(1);

    // Re-render while a refetch is in flight: the !isFetching guard blocks re-scheduling.
    mockUseGetRepositoryJobsWithPathQuery.mockReturnValue(fetchingResult(refetch));
    rerender(element(onStatusChange));
    mockUseGetRepositoryJobsWithPathQuery.mockReturnValue(fetchingResult(refetch));
    rerender(element(onStatusChange));

    // The refetch settles as error -> one new retry is armed and fires.
    mockUseGetRepositoryJobsWithPathQuery.mockReturnValue(errorResult(refetch));
    rerender(element(onStatusChange));
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(refetch).toHaveBeenCalledTimes(2);
    expect(onStatusChange).not.toHaveBeenCalledWith(NO_JOB_FOUND_ERROR);
  });
});
