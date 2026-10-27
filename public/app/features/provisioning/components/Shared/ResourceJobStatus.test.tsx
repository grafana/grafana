import { useEffect } from 'react';
import { render, screen } from 'test/test-utils';

import { type StepStatusInfo } from '../../Wizard/types';
import { createJob } from '../../mocks/factories';

import { ResourceJobStatus } from './ResourceJobStatus';

// The watcher reports whatever statuses a test queues, in the order given, in place of polling the API.
let emitted: StepStatusInfo[] = [];
jest.mock('../../Job/JobStatus', () => ({
  JobStatus: ({ onStatusChange }: { onStatusChange?: (info: StepStatusInfo) => void }) => {
    useEffect(() => {
      emitted.forEach((info) => onStatusChange?.(info));
    }, [onStatusChange]);
    return <div data-testid="job-status" />;
  },
}));

const urls = { newPullRequestURL: 'https://github.com/org/repo/compare/main...feature' };

describe('ResourceJobStatus', () => {
  beforeEach(() => {
    emitted = [];
  });

  it('recovers from a failed job lookup once the job finishes', () => {
    // The watcher reports a failed lookup the same way as a failed job, but can still find the job later.
    emitted = [
      { status: 'error', error: 'Error fetching active job' },
      { status: 'success', urls },
    ];
    const onSuccess = jest.fn();

    render(<ResourceJobStatus job={createJob()} jobType="delete" onSuccess={onSuccess} />);

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith({ status: 'success', urls });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the job failure that follows a failed lookup', () => {
    emitted = [
      { status: 'error', error: 'Error fetching active job' },
      { status: 'error', error: 'file not found' },
    ];

    render(<ResourceJobStatus job={createJob()} jobType="delete" />);

    expect(screen.getByRole('alert')).toHaveTextContent('file not found');
    expect(screen.getByRole('alert')).not.toHaveTextContent('Error fetching active job');
  });

  it('notifies success once even when the watcher re-emits it', () => {
    emitted = [
      { status: 'success', urls },
      { status: 'success', urls },
    ];
    const onSuccess = jest.fn();

    render(<ResourceJobStatus job={createJob()} jobType="delete" successTitle="Done" onSuccess={onSuccess} />);

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Done');
  });

  it('keeps a finished job with warnings and does not report success', () => {
    emitted = [
      { status: 'warning', warning: 'Resource not found' },
      { status: 'success', urls },
    ];
    const onSuccess = jest.fn();

    render(<ResourceJobStatus job={createJob()} jobType="delete" onSuccess={onSuccess} />);

    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Resource not found');
  });

  it('shows a failed job in place of the blank the watcher leaves', () => {
    emitted = [{ status: 'error', error: 'Error running job' }];

    render(<ResourceJobStatus job={createJob()} jobType="delete" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Error running job');
  });
});
