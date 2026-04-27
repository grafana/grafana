import { within, act } from '@testing-library/react';
import { render, screen } from 'test/test-utils';

import { type Job } from 'app/api/clients/provisioning/v0alpha1';
import { contextSrv } from 'app/core/services/context_srv';

import { JobStatus } from '../../Job/JobStatus';
import { type StepStatusInfo } from '../../Wizard/types';
import { useOrphanedResourceActions } from '../../hooks/useOrphanedResourceActions';

import { OrphanedResourceBanner } from './OrphanedResourceBanner';

jest.mock('../../hooks/useOrphanedResourceActions');

const mockNavigate = jest.fn();
jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../Job/JobStatus', () => ({
  JobStatus: jest.fn(() => <div data-testid="job-status">Job Status</div>),
}));

const MockJobStatus = jest.mocked(JobStatus);

const mockUseOrphanedResourceActions = jest.mocked(useOrphanedResourceActions);

function mockHook(overrides: Partial<ReturnType<typeof useOrphanedResourceActions>> = {}) {
  mockUseOrphanedResourceActions.mockReturnValue({
    submit: jest.fn(),
    submitRelease: jest.fn().mockResolvedValue(undefined),
    submitDelete: jest.fn().mockResolvedValue(undefined),
    isSubmitting: false,
    error: null,
    clearError: jest.fn(),
    ...overrides,
  });
}

describe('OrphanedResourceBanner', () => {
  beforeEach(() => {
    jest.spyOn(contextSrv, 'hasRole').mockImplementation((role: string) => role === 'Admin');
    contextSrv.isGrafanaAdmin = false;
    mockHook();
    mockNavigate.mockReset();
    MockJobStatus.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows Convert to local and Delete for admins', () => {
    render(<OrphanedResourceBanner repositoryName="gone-repo" />);

    expect(screen.getByRole('button', { name: 'Convert to local' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('does not show action buttons for non-admins and shows contact-admin copy', () => {
    jest.spyOn(contextSrv, 'hasRole').mockReturnValue(false);
    contextSrv.isGrafanaAdmin = false;

    render(<OrphanedResourceBanner repositoryName="gone-repo" />);

    expect(screen.queryByRole('button', { name: 'Convert to local' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /Contact your Grafana administrator to convert this resource to local or delete all resources from the missing repository/
      )
    ).toBeInTheDocument();
  });

  it('opens release confirmation and calls submitRelease when confirmed', async () => {
    const submitRelease = jest.fn().mockResolvedValue({} as Job);
    mockHook({ submitRelease });

    const { user } = render(<OrphanedResourceBanner repositoryName="gone-repo" />);

    await user.click(screen.getByRole('button', { name: 'Convert to local' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Convert all resources to local from this repository?')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Convert to local' }));

    expect(submitRelease).toHaveBeenCalledTimes(1);
  });

  it('opens delete confirmation and calls submitDelete when confirmed', async () => {
    const submitDelete = jest.fn().mockResolvedValue({} as Job);
    mockHook({ submitDelete });

    const { user } = render(<OrphanedResourceBanner repositoryName="gone-repo" />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete all resources from this repository?')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(submitDelete).toHaveBeenCalledTimes(1);
  });

  it('shows an error alert when the hook exposes an error and no job exists', () => {
    mockHook({ error: new Error('API failure') });

    render(<OrphanedResourceBanner repositoryName="gone-repo" />);

    expect(screen.getByText('Failed to create job for orphaned resources')).toBeInTheDocument();
  });

  it('does not show an error alert when error is null', () => {
    mockHook({ error: null });

    render(<OrphanedResourceBanner repositoryName="gone-repo" />);

    expect(screen.queryByText('Failed to create job for orphaned resources')).not.toBeInTheDocument();
  });

  describe('post-action behavior', () => {
    async function triggerJobWithStatus(status: StepStatusInfo['status']) {
      const submitRelease = jest.fn().mockResolvedValue({ metadata: { name: 'job-1' } } as Job);
      mockHook({ submitRelease });

      const { user } = render(<OrphanedResourceBanner repositoryName="gone-repo" />);

      await user.click(screen.getByRole('button', { name: 'Convert to local' }));
      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Convert to local' }));

      const onStatusChange = MockJobStatus.mock.lastCall![0].onStatusChange!;

      const statusInfo: StepStatusInfo =
        status === 'success'
          ? { status: 'success' }
          : status === 'warning'
            ? { status: 'warning', warning: 'partial' }
            : { status: 'error', error: 'something failed' };
      act(() => {
        onStatusChange(statusInfo);
      });

      return { user };
    }

    it('navigates to /dashboards on job success', async () => {
      await triggerJobWithStatus('success');

      expect(mockNavigate).toHaveBeenCalledWith('/dashboards');
    });

    it('shows a "Go to dashboards" button on job warning', async () => {
      const { user } = await triggerJobWithStatus('warning');

      expect(mockNavigate).not.toHaveBeenCalled();

      const goButton = screen.getByRole('button', { name: 'Go to dashboards' });
      expect(goButton).toBeInTheDocument();

      await user.click(goButton);
      expect(mockNavigate).toHaveBeenCalledWith('/dashboards');
    });

    it('shows a dismiss button on job error that resets to the original banner', async () => {
      const { user } = await triggerJobWithStatus('error');

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: 'Go to dashboards' })).not.toBeInTheDocument();

      const closeButton = screen.getByRole('button', { name: /close alert/i });
      await user.click(closeButton);

      expect(screen.getByText('This resource is managed by a repository that no longer exists')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Convert to local' })).toBeInTheDocument();
    });
  });
});
