import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, testWithFeatureToggles } from 'test/test-utils';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions } from 'app/features/alerting/unified/mocks';
import { AccessControlAction } from 'app/types/accessControl';

import { type GrafanaGroupUpdatedResponse } from '../api/alertRuleModel';
import { type ContactPoint, RuleFormType, type RuleFormValues } from '../types/rule-form';

import { AlertRuleDrawerForm, type AlertRuleDrawerFormProps } from './AlertRuleDrawerForm';
import { EVALUATION_INTERVAL_FIELD_TEST_ID } from './rule-editor/RuleEvaluationIntervalField';

setupMswServer();

// Mock the hooks
const mockExecute = jest.fn();
jest.mock('../hooks/ruleGroup/useUpsertRuleFromRuleGroup', () => ({
  useAddRuleToRuleGroup: () => [{ execute: mockExecute }],
}));

const mockUpsertUngroupedGrafanaRule = jest.fn();
jest.mock('../hooks/useUpsertUngroupedGrafanaRule', () => ({
  useUpsertUngroupedGrafanaRule: () => mockUpsertUngroupedGrafanaRule,
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
  const user = userEvent.setup();
  const view = render(<AlertRuleDrawerForm {...defaultProps} {...props} />);
  return { ...view, user };
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
      const onClose = jest.fn();
      const { user } = renderDrawer({ onClose });

      await user.click(screen.getByRole('button', { name: /Cancel/i }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should reset form when Cancel is clicked with prefill', async () => {
      const onClose = jest.fn();
      const prefill: Partial<RuleFormValues> = {
        name: 'Prefilled Rule Name',
      };
      const { user, rerender } = renderDrawer({ onClose, prefill });

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
      const onContinueInAlerting = jest.fn();
      const onClose = jest.fn();
      const { user } = renderDrawer({ onContinueInAlerting, onClose });

      // Fill in a field
      const nameInput = screen.getByLabelText(/Name/i);
      await user.type(nameInput, 'Test Rule');

      // Click Continue in Alerting
      await user.click(screen.getByRole('button', { name: /Continue in Alerting/i }));

      await waitFor(() => {
        expect(onContinueInAlerting).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test Rule',
            evaluateFor: '0s',
          })
        );
      });
    });

    it('should normalize contact points when calling onContinueInAlerting', async () => {
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

      const { user } = renderDrawer({ onContinueInAlerting, onClose, prefill });

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
      const onContinueInAlerting = jest.fn();
      const onClose = jest.fn();
      const { user } = renderDrawer({ onContinueInAlerting, onClose });

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
      const onClose = jest.fn();
      const mockResponse: GrafanaGroupUpdatedResponse = {
        message: 'Rule created successfully',
        created: ['rule-uid'],
      };
      mockExecute.mockResolvedValue(mockResponse);

      // Prefill with required fields (folder and group are required for form submission)
      const prefill: Partial<RuleFormValues> = {
        name: 'Test Alert Rule',
        folder: { title: 'Test Folder', uid: 'test-folder-uid' },
        group: 'test-group',
        evaluateEvery: '1m',
        type: RuleFormType.grafana,
        queries: [
          {
            refId: 'A',
            datasourceUid: 'test-ds',
            queryType: '',
            model: { refId: 'A' },
          },
        ],
        condition: 'A',
      };

      const { user } = renderDrawer({ onClose, prefill });

      // Click Create
      await user.click(screen.getByRole('button', { name: /Create/i }));

      // Wait for the execute function to be called
      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalled();
      });

      // Drawer should close on success
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('should show validation error when form is invalid', async () => {
      const { user } = renderDrawer();

      // Try to submit without filling required fields (name, folder, group are required)
      await user.click(screen.getByRole('button', { name: /Create/i }));

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Validation error',
          'Please correct the errors in the form and try again.'
        );
      });
    });
  });

  // The drawer's submit path is gated on alerting.rulesAPIV2:
  //   - disabled → legacy `addRuleToRuleGroup` (with the "derive group from name" fallback)
  //   - enabled  → groupless app-platform create via `useUpsertUngroupedGrafanaRule`
  // The createAlertRuleFromPanel toggle gates whether the drawer is shown at all,
  // which happens upstream in NewRuleFromPanelButton — not asserted here.
  describe('Submit routing by alerting.rulesAPIV2 toggle', () => {
    // Group is required by the legacy path's form validation, so include it.
    const submittablePrefill: Partial<RuleFormValues> = {
      name: 'Test Alert Rule',
      folder: { title: 'Test Folder', uid: 'test-folder-uid' },
      group: 'test-group',
      evaluateEvery: '1m',
      type: RuleFormType.grafana,
      queries: [
        {
          refId: 'A',
          datasourceUid: 'test-ds',
          queryType: '',
          model: { refId: 'A' },
        },
      ],
      condition: 'A',
    };

    describe('when alerting.rulesAPIV2 is disabled (legacy grouped flow)', () => {
      it('calls the legacy addRuleToRuleGroup hook and not the v2 hook', async () => {
        const mockResponse: GrafanaGroupUpdatedResponse = {
          message: 'Rule created successfully',
          created: ['rule-uid'],
        };
        mockExecute.mockResolvedValue(mockResponse);

        const { user } = renderDrawer({ prefill: submittablePrefill });
        await user.click(screen.getByRole('button', { name: /Create/i }));

        await waitFor(() => {
          expect(mockExecute).toHaveBeenCalledTimes(1);
        });
        expect(mockUpsertUngroupedGrafanaRule).not.toHaveBeenCalled();
      });
    });

    describe('when alerting.rulesAPIV2 is enabled (v2 groupless flow)', () => {
      testWithFeatureToggles({ enable: ['alerting.rulesAPIV2'] });

      it('calls the v2 ungrouped hook with isUngroupedRuleGroup forced true', async () => {
        mockUpsertUngroupedGrafanaRule.mockResolvedValue('new-rule-uid');

        const { user } = renderDrawer({ prefill: submittablePrefill });
        await user.click(screen.getByRole('button', { name: /Create/i }));

        await waitFor(() => {
          expect(mockUpsertUngroupedGrafanaRule).toHaveBeenCalledTimes(1);
        });
        expect(mockUpsertUngroupedGrafanaRule).toHaveBeenCalledWith(
          expect.objectContaining({
            existingUid: undefined,
            values: expect.objectContaining({ isUngroupedRuleGroup: true }),
          })
        );
        expect(mockExecute).not.toHaveBeenCalled();
      });

      it('closes the drawer and shows a success notification on success', async () => {
        mockUpsertUngroupedGrafanaRule.mockResolvedValue('new-rule-uid');
        const onClose = jest.fn();

        const { user } = renderDrawer({ onClose, prefill: submittablePrefill });
        await user.click(screen.getByRole('button', { name: /Create/i }));

        await waitFor(() => {
          expect(onClose).toHaveBeenCalled();
        });
        expect(mockSuccess).toHaveBeenCalledWith(
          'Alert rule created',
          'Your alert rule has been created successfully.'
        );
      });

      it('shows an error notification when the v2 mutation rejects', async () => {
        mockUpsertUngroupedGrafanaRule.mockRejectedValue(new Error('boom from the api'));
        const onClose = jest.fn();

        const { user } = renderDrawer({ onClose, prefill: submittablePrefill });
        await user.click(screen.getByRole('button', { name: /Create/i }));

        await waitFor(() => {
          expect(mockError).toHaveBeenCalledWith('Failed to create alert rule', expect.stringContaining('boom'));
        });
        expect(onClose).not.toHaveBeenCalled();
      });

      it('hides the evaluation group picker and shows a per-rule evaluation interval input', () => {
        renderDrawer({ prefill: submittablePrefill });

        expect(screen.queryByTestId('group-picker')).not.toBeInTheDocument();
        expect(screen.queryByTestId('new-evaluation-group-button')).not.toBeInTheDocument();
        expect(screen.getByTestId(EVALUATION_INTERVAL_FIELD_TEST_ID)).toBeInTheDocument();
      });

      it('submits the evaluation interval as a rule property', async () => {
        mockUpsertUngroupedGrafanaRule.mockResolvedValue('new-rule-uid');

        const { user } = renderDrawer({ prefill: submittablePrefill });

        const intervalInput = within(screen.getByTestId(EVALUATION_INTERVAL_FIELD_TEST_ID)).getByRole('textbox');
        await user.clear(intervalInput);
        await user.type(intervalInput, '5m');

        await user.click(screen.getByRole('button', { name: /Create/i }));

        await waitFor(() => {
          expect(mockUpsertUngroupedGrafanaRule).toHaveBeenCalledWith(
            expect.objectContaining({
              values: expect.objectContaining({ evaluateEvery: '5m', evaluateFor: '0s' }),
            })
          );
        });
      });

      it('submits pending period as 0s because the drawer does not expose that field', async () => {
        mockUpsertUngroupedGrafanaRule.mockResolvedValue('new-rule-uid');

        const { user } = renderDrawer({
          prefill: { ...submittablePrefill, evaluateFor: '1m' },
        });
        await user.click(screen.getByRole('button', { name: /Create/i }));

        await waitFor(() => {
          expect(mockUpsertUngroupedGrafanaRule).toHaveBeenCalledWith(
            expect.objectContaining({
              values: expect.objectContaining({ evaluateFor: '0s' }),
            })
          );
        });
      });
    });
  });
});
