import { within } from '@testing-library/react';
import { render, screen } from 'test/test-utils';

import { Job } from 'app/api/clients/provisioning/v0alpha1';
import { contextSrv } from 'app/core/services/context_srv';

import { useOrphanedResourceActions } from '../../hooks/useOrphanedResourceActions';

import { OrphanedResourceBanner } from './OrphanedResourceBanner';

jest.mock('../../hooks/useOrphanedResourceActions');

const mockUseOrphanedResourceActions = jest.mocked(useOrphanedResourceActions);

function mockHook(overrides: Partial<ReturnType<typeof useOrphanedResourceActions>> = {}) {
  mockUseOrphanedResourceActions.mockReturnValue({
    resourceRef: {
      group: 'dashboard.grafana.app',
      kind: 'Dashboard',
      name: 'dash-uid',
    },
    submit: jest.fn(),
    submitRelease: jest.fn().mockRejectedValue(new Error('stub')),
    submitDelete: jest.fn().mockRejectedValue(new Error('stub')),
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows Release and Delete for admins', () => {
    render(<OrphanedResourceBanner uid="dash-uid" resourceType="dashboards" />);

    expect(screen.getByRole('button', { name: 'Release' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('does not show action buttons for non-admins and shows contact-admin copy', () => {
    jest.spyOn(contextSrv, 'hasRole').mockReturnValue(false);
    contextSrv.isGrafanaAdmin = false;

    render(<OrphanedResourceBanner uid="dash-uid" resourceType="dashboards" />);

    expect(screen.queryByRole('button', { name: 'Release' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(
      screen.getByText(/Contact your Grafana administrator to release or delete this resource/)
    ).toBeInTheDocument();
  });

  it('opens release confirmation and calls submitRelease when confirmed', async () => {
    const submitRelease = jest.fn().mockResolvedValue({} as Job);
    mockHook({ submitRelease });

    const { user } = render(<OrphanedResourceBanner uid="dash-uid" resourceType="dashboards" />);

    await user.click(screen.getByRole('button', { name: 'Release' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Release from provisioning?')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Release' }));

    expect(submitRelease).toHaveBeenCalledTimes(1);
  });

  it('opens delete confirmation and calls submitDelete when confirmed', async () => {
    const submitDelete = jest.fn().mockResolvedValue({} as Job);
    mockHook({ submitDelete });

    const { user } = render(<OrphanedResourceBanner uid="dash-uid" resourceType="folders" />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete this folder?')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(submitDelete).toHaveBeenCalledTimes(1);
  });
});
