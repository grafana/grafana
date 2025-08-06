import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { config, reportInteraction } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { getExternalUserMngLinkUrl } from 'app/features/users/utils';

import { InviteUserButton } from './InviteUserButton';

// Mock dependencies
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    featureToggles: {
      inviteUserExperimental: true,
    },
    externalUserMngLinkUrl: 'https://example.com/invite',
  },
  reportInteraction: jest.fn(),
}));

jest.mock('app/core/core', () => ({
  contextSrv: {
    hasPermission: jest.fn(),
  },
}));

jest.mock('app/features/users/utils', () => ({
  getExternalUserMngLinkUrl: jest.fn(),
}));

const mockContextSrv = jest.mocked(contextSrv);
const mockConfig = jest.mocked(config);
const mockReportInteraction = jest.mocked(reportInteraction);
const mockGetExternalUserMngLinkUrl = jest.mocked(getExternalUserMngLinkUrl);

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

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetExternalUserMngLinkUrl.mockReturnValue(mockInviteUrl);
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

  describe('Error Handling - Preventing crashes', () => {
    beforeEach(() => {
      mockConfig.externalUserMngLinkUrl = 'https://example.com/invite';
      mockContextSrv.hasPermission.mockReturnValue(true);
      mockMatchMedia(true);
    });

    it('should handle URL generation errors gracefully', async () => {
      mockGetExternalUserMngLinkUrl.mockImplementation(() => {
        throw new Error('URL generation failed');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup();

      render(<InviteUserButton />);

      // Should not crash when URL generation fails
      await user.click(screen.getByRole('button', { name: /invite user/i }));

      expect(consoleSpy).toHaveBeenCalledWith('Failed to handle invite user click:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle popup blocking gracefully', async () => {
      mockWindowOpen.mockImplementation(() => {
        throw new Error('Popup blocked');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup();

      render(<InviteUserButton />);

      // Should not crash when popup is blocked
      await user.click(screen.getByRole('button', { name: /invite user/i }));

      expect(consoleSpy).toHaveBeenCalledWith('Failed to handle invite user click:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });
});
