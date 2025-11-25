import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { config, reportInteraction } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { getExternalUserMngLinkUrl, getUpgradeUrl } from 'app/features/users/utils';

import { InviteUserButton } from './InviteUserButton';

// Mock dependencies
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    externalUserMngLinkUrl: 'https://example.com/invite',
    namespace: 'default', // on-prem by default
    bootData: {
      user: {
        orgName: 'test-org',
      },
    },
  },
  reportInteraction: jest.fn(),
}));

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    hasPermission: jest.fn(),
  },
}));

jest.mock('app/features/users/utils', () => ({
  getExternalUserMngLinkUrl: jest.fn(),
  getUpgradeUrl: jest.fn(),
}));

jest.mock('app/api/clients/legacy', () => ({
  useGetCurrentOrgQuotaQuery: jest.fn(),
}));

const mockContextSrv = jest.mocked(contextSrv);
const mockConfig = jest.mocked(config);
const mockReportInteraction = jest.mocked(reportInteraction);
const mockGetExternalUserMngLinkUrl = jest.mocked(getExternalUserMngLinkUrl);
const mockGetUpgradeUrl = jest.mocked(getUpgradeUrl);

// Mock window.open
const mockWindowOpen = jest.fn();
Object.defineProperty(window, 'open', {
  value: mockWindowOpen,
  writable: true,
});

// Mock window.matchMedia for responsive testing
const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    value: jest.fn().mockImplementation(() => ({
      matches,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
    writable: true,
  });
};

describe('InviteUserButton', () => {
  const mockInviteUrl = 'https://example.com/invite?cnt=invite-user-top-bar';
  const mockUpgradeUrl = 'https://grafana.com/orgs/test-org/my-account/manage-plan?cnt=upgrade-user-top-bar';

  // Import the mocked hook
  const { useGetCurrentOrgQuotaQuery } = require('app/api/clients/legacy');
  const mockUseGetCurrentOrgQuotaQuery = jest.mocked(useGetCurrentOrgQuotaQuery);

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetExternalUserMngLinkUrl.mockReturnValue(mockInviteUrl);
    mockGetUpgradeUrl.mockReturnValue(mockUpgradeUrl);

    // Default mock: no quotas, no error (on-prem scenario)
    mockUseGetCurrentOrgQuotaQuery.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // Default to on-prem
    mockConfig.namespace = 'default';
  });

  describe('Business Logic - When button should appear', () => {
    it('should not render when user lacks permission', () => {
      mockConfig.externalUserMngLinkUrl = 'https://example.com/invite';
      mockContextSrv.hasPermission.mockReturnValue(false);
      mockMatchMedia(true);

      render(<InviteUserButton />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should not render when external user management URL is not configured', () => {
      mockConfig.externalUserMngLinkUrl = '';
      mockContextSrv.hasPermission.mockReturnValue(true);
      mockMatchMedia(true);

      render(<InviteUserButton />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('User Experience - Responsive behavior', () => {
    beforeEach(() => {
      mockConfig.externalUserMngLinkUrl = 'https://example.com/invite';
      mockContextSrv.hasPermission.mockReturnValue(true);
    });

    it('should show text on large screens', () => {
      mockMatchMedia(true); // Large screen (≥lg)

      render(<InviteUserButton />);

      const button = screen.getByRole('button', { name: /invite user/i });
      expect(button).toHaveTextContent('Invite');
    });

    it('should show icon only on small screens', () => {
      mockMatchMedia(false); // Small screen (<lg)

      render(<InviteUserButton />);

      const button = screen.getByRole('button', { name: /invite user/i });
      expect(button).not.toHaveTextContent('Invite');
    });
  });

  describe('Core Functionality - Click behavior', () => {
    beforeEach(() => {
      mockConfig.externalUserMngLinkUrl = 'https://example.com/invite';
      mockContextSrv.hasPermission.mockReturnValue(true);
      mockMatchMedia(true);
    });

    it('should track analytics and open invite URL when clicked', async () => {
      const user = userEvent.setup();

      render(<InviteUserButton />);

      await user.click(screen.getByRole('button', { name: /invite user/i }));

      // Verify the complete user flow
      expect(mockReportInteraction).toHaveBeenCalledWith('invite_user_button_clicked', {
        placement: 'top_bar_right',
      });
      expect(mockGetExternalUserMngLinkUrl).toHaveBeenCalledWith('invite-user-top-bar');
      expect(mockWindowOpen).toHaveBeenCalledWith(mockInviteUrl, '_blank');
    });
  });

  describe('Upgrade functionality - Grafana Cloud', () => {
    beforeEach(() => {
      mockConfig.externalUserMngLinkUrl = 'https://example.com/invite';
      mockContextSrv.hasPermission.mockReturnValue(true);
      mockMatchMedia(true);
      // Simulate Grafana Cloud
      mockConfig.namespace = 'stacks-12345';
    });

    it('should show invite button when quota is not reached', () => {
      mockUseGetCurrentOrgQuotaQuery.mockReturnValue({
        data: [{ target: 'org_user', limit: 5, used: 2, org_id: 1 }],
        error: undefined,
        isLoading: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      render(<InviteUserButton />);

      const button = screen.getByRole('button', { name: /invite user/i });
      expect(button).toHaveTextContent('Invite');
    });

    it('should show upgrade button when quota is reached', () => {
      mockUseGetCurrentOrgQuotaQuery.mockReturnValue({
        data: [{ target: 'org_user', limit: 5, used: 5, org_id: 1 }],
        error: undefined,
        isLoading: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      render(<InviteUserButton />);

      const button = screen.getByRole('button', { name: /upgrade to invite more users/i });
      expect(button).toHaveTextContent('Upgrade');
    });

    it('should open upgrade URL when upgrade button is clicked', async () => {
      mockUseGetCurrentOrgQuotaQuery.mockReturnValue({
        data: [{ target: 'org_user', limit: 5, used: 5, org_id: 1 }],
        error: undefined,
        isLoading: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const user = userEvent.setup();

      render(<InviteUserButton />);

      await user.click(screen.getByRole('button', { name: /upgrade to invite more users/i }));

      expect(mockReportInteraction).toHaveBeenCalledWith('upgrade_user_button_clicked', {
        placement: 'top_bar_right',
      });
      expect(mockGetUpgradeUrl).toHaveBeenCalledWith('upgrade-user-top-bar');
      expect(mockWindowOpen).toHaveBeenCalledWith(mockUpgradeUrl, '_blank');
    });

    it('should not fetch quotas on on-prem instances', () => {
      mockConfig.namespace = 'default'; // on-prem

      render(<InviteUserButton />);

      // Should skip the query
      expect(mockUseGetCurrentOrgQuotaQuery).toHaveBeenCalledWith(undefined, {
        skip: true,
      });
    });

    it('should fetch quotas on cloud instances when button will render', () => {
      mockConfig.namespace = 'stacks-12345'; // cloud

      render(<InviteUserButton />);

      // Should not skip the query
      expect(mockUseGetCurrentOrgQuotaQuery).toHaveBeenCalledWith(undefined, {
        skip: false,
      });
    });
  });

  describe('Error Handling - Preventing crashes', () => {
    beforeEach(() => {
      mockConfig.externalUserMngLinkUrl = 'https://example.com/invite';
      mockContextSrv.hasPermission.mockReturnValue(true);
      mockMatchMedia(true);
      mockConfig.namespace = 'default'; // on-prem
    });

    it('should handle quota API errors gracefully', () => {
      mockConfig.namespace = 'stacks-12345';
      mockUseGetCurrentOrgQuotaQuery.mockReturnValue({
        data: undefined,
        error: { message: 'API Error' },
        isLoading: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(<InviteUserButton />);

      // Should still render the invite button (no quota check)
      expect(screen.getByRole('button', { name: /invite user/i })).toBeInTheDocument();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch org quotas:', { message: 'API Error' });

      consoleSpy.mockRestore();
    });
  });
});
