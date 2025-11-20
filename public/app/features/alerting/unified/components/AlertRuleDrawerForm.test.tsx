import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions } from 'app/features/alerting/unified/mocks';
import { AccessControlAction } from 'app/types/accessControl';

import { GrafanaGroupUpdatedResponse } from '../api/alertRuleModel';
import { ContactPoint, RuleFormType, RuleFormValues } from '../types/rule-form';

import { AlertRuleDrawerForm, AlertRuleDrawerFormProps } from './AlertRuleDrawerForm';

setupMswServer();

// Mock the hooks
const mockExecute = jest.fn();
jest.mock('../hooks/ruleGroup/useUpsertRuleFromRuleGroup', () => ({
  useAddRuleToRuleGroup: () => [{ execute: mockExecute }],
}));

// Mock notification hooks
const mockError = jest.fn();
const mockSuccess = jest.fn();
jest.mock('app/core/copy/appNotification', () => ({
  useAppNotification: () => ({
    error: mockError,
    success: mockSuccess,
  }),
}));

const defaultProps: AlertRuleDrawerFormProps = {
  isOpen: true,
  onClose: jest.fn(),
};

const renderDrawer = (props: Partial<AlertRuleDrawerFormProps> = {}) => {
  return render(<AlertRuleDrawerForm {...defaultProps} {...props} />);
};

describe('AlertRuleDrawerForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    grantUserPermissions([
      AccessControlAction.AlertingRuleCreate,
      AccessControlAction.AlertingRuleRead,
      AccessControlAction.AlertingRuleUpdate,
      AccessControlAction.AlertingRuleDelete,
    ]);
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      renderDrawer({ isOpen: false });
      expect(screen.queryByRole('button', { name: /Create/i })).not.toBeInTheDocument();
    });

    it('should render "Continue in Alerting" button when callback is provided', () => {
      renderDrawer({ onContinueInAlerting: jest.fn() });
      expect(screen.getByRole('button', { name: /Continue in Alerting/i })).toBeInTheDocument();
    });
  });

  describe('Cancel button', () => {
    it('should call onClose when Cancel is clicked', async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();
      renderDrawer({ onClose });

      await user.click(screen.getByRole('button', { name: /Cancel/i }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should reset form when Cancel is clicked with prefill', async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();
      const prefill: Partial<RuleFormValues> = {
        name: 'Prefilled Rule Name',
      };
      const { rerender } = renderDrawer({ onClose, prefill });

      // Verify prefilled value is present
      const nameInput = screen.getByLabelText(/Name/i);
      expect(nameInput).toHaveValue('Prefilled Rule Name');

      // Modify the field
      await user.clear(nameInput);
      await user.type(nameInput, 'Changed Name');
      expect(nameInput).toHaveValue('Changed Name');

      // Click cancel - this triggers reset to prefill
      await user.click(screen.getByRole('button', { name: /Cancel/i }));
      expect(onClose).toHaveBeenCalled();

      // Reopen to verify reset happened
      rerender(<AlertRuleDrawerForm {...defaultProps} onClose={onClose} prefill={prefill} isOpen={true} />);
      expect(screen.getByLabelText(/Name/i)).toHaveValue('Prefilled Rule Name');
    });
  });

  describe('Continue in Alerting button', () => {
    it('should call onContinueInAlerting with current form values', async () => {
      const user = userEvent.setup();
      const onContinueInAlerting = jest.fn();
      const onClose = jest.fn();
      renderDrawer({ onContinueInAlerting, onClose });

      // Fill in a field
      const nameInput = screen.getByLabelText(/Name/i);
      await user.type(nameInput, 'Test Rule');

      // Click Continue in Alerting
      await user.click(screen.getByRole('button', { name: /Continue in Alerting/i }));

      await waitFor(() => {
        expect(onContinueInAlerting).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test Rule',
          })
        );
      });
    });

    it('should normalize contact points when calling onContinueInAlerting', async () => {
      const user = userEvent.setup();
      const onContinueInAlerting = jest.fn();
      const onClose = jest.fn();

      // Provide prefill with partial contact point data
      // We intentionally create an incomplete ContactPoint to test that normalizeContactPoints fills in the missing optional fields with defaults
      const prefill: Partial<RuleFormValues> = {
        name: 'Test',
        contactPoints: {
          grafana: {
            selectedContactPoint: 'test-contact',
          } as ContactPoint,
        },
      };

      renderDrawer({ onContinueInAlerting, onClose, prefill });

      // Click Continue in Alerting
      await user.click(screen.getByRole('button', { name: /Continue in Alerting/i }));

      await waitFor(() => {
        expect(onContinueInAlerting).toHaveBeenCalledWith(
          expect.objectContaining({
            contactPoints: expect.objectContaining({
              grafana: expect.objectContaining({
                selectedContactPoint: 'test-contact',
                // Verify normalization added default values
                overrideGrouping: false,
                groupBy: [],
                overrideTimings: false,
                groupWaitValue: '',
                groupIntervalValue: '',
                repeatIntervalValue: '',
                muteTimeIntervals: [],
                activeTimeIntervals: [],
              }),
            }),
          })
        );
      });
    });

    it('should close drawer after calling onContinueInAlerting', async () => {
      const user = userEvent.setup();
      const onContinueInAlerting = jest.fn();
      const onClose = jest.fn();
      renderDrawer({ onContinueInAlerting, onClose });

      // Click Continue in Alerting
      await user.click(screen.getByRole('button', { name: /Continue in Alerting/i }));

      await waitFor(() => {
        expect(onContinueInAlerting).toHaveBeenCalled();
      });
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Prefill behavior', () => {
    it('should initialize form with prefill values', () => {
      const prefill: Partial<RuleFormValues> = {
        name: 'Prefilled Rule',
        type: RuleFormType.grafana,
      };
      renderDrawer({ prefill });

      expect(screen.getByLabelText(/Name/i)).toHaveValue('Prefilled Rule');
    });

    it('should reset form when prefill changes', async () => {
      const prefill1: Partial<RuleFormValues> = {
        name: 'First Rule',
      };
      const { rerender } = render(<AlertRuleDrawerForm {...defaultProps} prefill={prefill1} />);

      expect(screen.getByLabelText(/Name/i)).toHaveValue('First Rule');

      // Update prefill
      const prefill2: Partial<RuleFormValues> = {
        name: 'Second Rule',
      };
      rerender(<AlertRuleDrawerForm {...defaultProps} prefill={prefill2} />);

      // Wait for the useEffect to trigger the reset
      await waitFor(() => {
        expect(screen.getByLabelText(/Name/i)).toHaveValue('Second Rule');
      });
    });

    it('should reset to defaults when prefill becomes undefined', async () => {
      const prefill: Partial<RuleFormValues> = {
        name: 'Prefilled Rule',
      };
      const { rerender } = render(<AlertRuleDrawerForm {...defaultProps} prefill={prefill} />);

      expect(screen.getByLabelText(/Name/i)).toHaveValue('Prefilled Rule');

      // Clear prefill
      rerender(<AlertRuleDrawerForm {...defaultProps} prefill={undefined} />);

      // Wait for the useEffect to trigger the reset
      await waitFor(() => {
        expect(screen.getByLabelText(/Name/i)).toHaveValue('');
      });
    });
  });

  describe('Create button and submission', () => {
    it('should close drawer on successful rule creation', async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();
      const mockResponse: GrafanaGroupUpdatedResponse = {
        message: 'Rule created successfully',
        created: ['rule-uid'],
      };
      mockExecute.mockResolvedValue(mockResponse);

      renderDrawer({ onClose });

      // Fill in required field
      const nameInput = screen.getByLabelText(/Name/i);
      await user.type(nameInput, 'Test Alert Rule');

      // Click Create
      await user.click(screen.getByRole('button', { name: /Create/i }));

      // Drawer should close on success
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('should show validation error when form is invalid', async () => {
      const user = userEvent.setup();
      renderDrawer();

      // Try to submit without filling required fields (name is required)
      await user.click(screen.getByRole('button', { name: /Create/i }));

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith('There are errors in the form. Please correct them and try again!');
      });
    });
  });
});
