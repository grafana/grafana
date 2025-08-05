// Mock dependencies before importing the module under test
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const mockConfigData = {
  featureToggles: { inviteUserExperimental: false },
  externalUserMngLinkUrl: '',
};

jest.mock('app/core/config', () => ({
  config: mockConfigData,
}));

const mockContextSrvData = {
  hasPermission: jest.fn().mockReturnValue(false),
};

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: mockContextSrvData,
}));

jest.mock('app/features/users/utils', () => ({
  getExternalUserMngLinkUrl: jest.fn(),
}));

import { reportInteraction } from '@grafana/runtime';
import { getExternalUserMngLinkUrl } from 'app/features/users/utils';
import { AccessControlAction } from 'app/types/accessControl';

import { performInviteUserClick } from './InviteUserButtonUtils';

const mockReportInteraction = jest.mocked(reportInteraction);
const mockGetExternalUserMngLinkUrl = jest.mocked(getExternalUserMngLinkUrl);

// Mock window.open
const mockWindowOpen = jest.fn();
Object.defineProperty(window, 'open', {
  value: mockWindowOpen,
  writable: true,
});

describe('InviteUserButtonUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('shouldRenderInviteUserButton', () => {
    it('should return true when all conditions are met', async () => {
      mockConfigData.featureToggles.inviteUserExperimental = true;
      mockConfigData.externalUserMngLinkUrl = 'https://example.com/invite';
      mockContextSrvData.hasPermission.mockReturnValue(true);

      jest.resetModules();
      const { shouldRenderInviteUserButton } = await import('./InviteUserButtonUtils');

      expect(shouldRenderInviteUserButton).toBe(true);
      expect(mockContextSrvData.hasPermission).toHaveBeenCalledWith(AccessControlAction.OrgUsersAdd);
    });

    it('should return falsy when any condition fails', async () => {
      // Test with feature toggle disabled
      mockConfigData.featureToggles.inviteUserExperimental = false;
      mockConfigData.externalUserMngLinkUrl = 'https://example.com/invite';
      mockContextSrvData.hasPermission.mockReturnValue(true);

      jest.resetModules();
      const { shouldRenderInviteUserButton } = await import('./InviteUserButtonUtils');

      expect(shouldRenderInviteUserButton).toBeFalsy();
    });
  });

  describe('performInviteUserClick', () => {
    const mockUrl = 'https://example.com/invite?cnt=test';

    beforeEach(() => {
      mockGetExternalUserMngLinkUrl.mockReturnValue(mockUrl);
    });

    it('should report interaction, get URL, and open window', () => {
      const placement = 'top_bar_right';
      const cnt = 'invite-user-test';

      performInviteUserClick(placement, cnt);

      expect(mockReportInteraction).toHaveBeenCalledWith('invite_user_button_clicked', {
        placement,
      });
      expect(mockGetExternalUserMngLinkUrl).toHaveBeenCalledWith(cnt);
      expect(mockWindowOpen).toHaveBeenCalledWith(mockUrl, '_blank');
    });
  });
});
