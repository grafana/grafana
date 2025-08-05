import type { FeatureToggles } from '@grafana/data';
import { reportInteraction, config } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { getExternalUserMngLinkUrl } from 'app/features/users/utils';
import { AccessControlAction } from 'app/types/accessControl';

import { performInviteUserClick, shouldRenderInviteUserButton } from './InviteUserButtonUtils';

// Mock dependencies
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
  config: {
    featureToggles: {} as Partial<FeatureToggles>,
    externalUserMngLinkUrl: '',
  },
}));

jest.mock('app/core/core', () => ({
  contextSrv: {
    hasPermission: jest.fn(),
  },
}));

jest.mock('app/features/users/utils', () => ({
  getExternalUserMngLinkUrl: jest.fn(),
}));

const mockReportInteraction = jest.mocked(reportInteraction);
const mockConfig = jest.mocked(config);
const mockContextSrv = jest.mocked(contextSrv);
const mockGetExternalUserMngLinkUrl = jest.mocked(getExternalUserMngLinkUrl);

// Type assertion to make mockConfig.featureToggles assignable
const mockFeatureToggles = mockConfig.featureToggles as Partial<FeatureToggles>;

// Mock window.open
const mockWindowOpen = jest.fn();
Object.defineProperty(window, 'open', {
  value: mockWindowOpen,
  writable: true,
});

describe('InviteUserButtonUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default mocks
    mockFeatureToggles.inviteUserExperimental = true;
    mockConfig.externalUserMngLinkUrl = 'https://example.com/invite';
    mockContextSrv.hasPermission.mockReturnValue(true);
    mockGetExternalUserMngLinkUrl.mockReturnValue('https://example.com/invite?cnt=test');
  });

  describe('shouldRenderInviteUserButton', () => {
    it('should return true when all conditions are met', () => {
      expect(shouldRenderInviteUserButton()).toBe(true);
      expect(mockContextSrv.hasPermission).toHaveBeenCalledWith(AccessControlAction.OrgUsersAdd);
    });

    it('should return false when feature toggle is disabled', () => {
      mockFeatureToggles.inviteUserExperimental = false;

      expect(shouldRenderInviteUserButton()).toBe(false);
    });

    it('should return false when URL is not configured', () => {
      mockConfig.externalUserMngLinkUrl = '';

      expect(shouldRenderInviteUserButton()).toBeFalsy();
    });

    it('should return false when user lacks permission', () => {
      mockContextSrv.hasPermission.mockReturnValue(false);

      expect(shouldRenderInviteUserButton()).toBe(false);
    });
  });

  describe('performInviteUserClick', () => {
    it('should report interaction, get URL, and open window', () => {
      const placement = 'top_bar_right';
      const cnt = 'invite-user-test';

      performInviteUserClick(placement, cnt);

      expect(mockReportInteraction).toHaveBeenCalledWith('invite_user_button_clicked', {
        placement,
      });
      expect(mockGetExternalUserMngLinkUrl).toHaveBeenCalledWith(cnt);
      expect(mockWindowOpen).toHaveBeenCalledWith('https://example.com/invite?cnt=test', '_blank');
    });
  });
});
