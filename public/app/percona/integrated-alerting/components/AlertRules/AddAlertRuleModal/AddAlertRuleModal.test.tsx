import React from 'react';
import { AddAlertRuleModal } from './AddAlertRuleModal';
import { AlertRule, AlertRuleSeverity } from '../AlertRules.types';
import { templateStubs } from '../../AlertRuleTemplate/__mocks__/alertRuleTemplateStubs';
import { SEVERITY_OPTIONS } from './AddAlertRulesModal.constants';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('../AlertRules.service');
jest.mock('../../AlertRuleTemplate/AlertRuleTemplate.service');
jest.mock('../../NotificationChannel/NotificationChannel.service');

jest.mock('app/core/app_events', () => {
  return {
    appEvents: {
      emit: jest.fn(),
    },
  };
});

describe('AddAlertRuleModal', () => {
  const { name: templateName, summary: templateSummary, params: templateParams = [] } = templateStubs[0];
  const initialValues: AlertRule = {
    ruleId: '/rule_id/ded33d30-1b65-4b43-ba45-75ca52b48fa5',
    createdAt: '2021-01-19 12:53:16.082',
    duration: '3600s',
    filters: [],
    severity: 'Critical',
    name: 'Alert1',
    lastNotified: '',
    disabled: false,
    expr: '',
    params: templateParams.map(({ name, type, unit, summary }) => ({ name, type, summary, unit, value: 10 })),
    rawValues: {
      channels: [],
      filters: [],
      disabled: false,
      expr: '',
      rule_id: '/rule_id/ded33d30-1b65-4b43-ba45-75ca52b48fa5',
      summary: templateSummary,
      params_definitions: [],
      params_values: [],
      default_for: '3600s',
      for: '3600s',
      default_severity: AlertRuleSeverity.SEVERITY_CRITICAL,
      name: templateName,
      expr_template: '',
      template_name: templateName,
      severity: 'SEVERITY_CRITICAL',
      created_at: '2021-01-19T12:53:16.082610Z',
    },
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render modal', async () => {
    await waitFor(() => render(<AddAlertRuleModal setVisible={jest.fn()} isVisible />));

    expect(screen.getByTestId('modal-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('add-alert-rule-modal-form')).toBeInTheDocument();
    expect(screen.getByTestId('add-alert-rule-modal-add-button')).toBeInTheDocument();
  });

  it('does not render the modal when visible is set to false', async () => {
    await waitFor(() => render(<AddAlertRuleModal setVisible={jest.fn()} isVisible={false} />));

    expect(screen.queryByTestId('add-alert-rule-modal-form')).not.toBeInTheDocument();
  });

  it('renders the modal when visible is set to true', async () => {
    await waitFor(() => render(<AddAlertRuleModal setVisible={jest.fn()} isVisible />));

    expect(screen.getByTestId('add-alert-rule-modal-form')).toBeInTheDocument();
  });

  it('should have the submit button disabled by default when adding a new rule', async () => {
    await waitFor(() => render(<AddAlertRuleModal setVisible={jest.fn()} isVisible />));

    expect(screen.getByTestId('add-alert-rule-modal-add-button')).toBeDisabled();
  });

  it('should enable the submit button if all fields are valid', async () => {
    await waitFor(() => render(<AddAlertRuleModal setVisible={jest.fn()} isVisible alertRule={initialValues} />));

    const thresholdInput = screen.getByTestId(`${templateParams[0].name}-number-input`);
    await waitFor(() =>
      fireEvent.change(thresholdInput, {
        target: {
          value: '2',
        },
      })
    );

    expect(screen.getByTestId('add-alert-rule-modal-add-button')).toHaveProperty('disabled', false);
  });

  it('should disable the submit button if a negative duration is inserted', async () => {
    await waitFor(() => render(<AddAlertRuleModal setVisible={jest.fn()} isVisible alertRule={initialValues} />));

    const thresholdInput = screen.getByTestId(`${templateParams[0].name}-number-input`);
    const durationInput = screen.getByTestId('duration-number-input');

    await waitFor(() =>
      fireEvent.change(thresholdInput, {
        target: {
          value: '2',
        },
      })
    );

    await waitFor(() =>
      fireEvent.change(durationInput, {
        target: {
          value: '-10',
        },
      })
    );

    expect(screen.getByTestId('add-alert-rule-modal-add-button')).toBeDisabled();
  });

  it('should disable template edition', async () => {
    await waitFor(() => render(<AddAlertRuleModal setVisible={jest.fn()} isVisible alertRule={initialValues} />));
    // checking template-select-input
    expect(screen.getByTestId('add-alert-rule-modal-form').querySelectorAll('input')[0]).toHaveProperty(
      'disabled',
      true
    );
  });

  it('should change params when switching templates', async () => {
    const { container } = await waitFor(() => render(<AddAlertRuleModal setVisible={jest.fn()} isVisible />));

    expect(screen.queryByTestId('template-1-threshold-number-input')).not.toBeInTheDocument();

    await waitFor(() => fireEvent.keyDown(container.querySelectorAll('input')[0], { key: 'ArrowDown' }));
    await waitFor(() => fireEvent.click(screen.getAllByLabelText('Select option')[0]));

    expect(screen.getByTestId('template-1-threshold-number-input')).toBeInTheDocument();

    await waitFor(() => fireEvent.keyDown(container.querySelectorAll('input')[0], { key: 'ArrowDown' }));
    await waitFor(() => fireEvent.click(screen.getAllByLabelText('Select option')[3]));

    expect(screen.queryByTestId('template-1-threshold-number-input')).not.toBeInTheDocument();
    expect(screen.getByTestId('template-4-from-number-input')).toBeInTheDocument();
    expect(screen.getByTestId('template-4-to-number-input')).toBeInTheDocument();
  });

  it('should pre-fill severity and duration when switching templates', async () => {
    const { container } = await waitFor(() => render(<AddAlertRuleModal setVisible={jest.fn()} isVisible />));

    expect(screen.getByTestId('duration-number-input').textContent).toHaveLength(0);

    // checking severity-select-input
    const selectContainer = screen.getByText('Severity')?.parentElement?.nextSibling;
    expect(selectContainer).toHaveTextContent('Choose');

    await waitFor(() => fireEvent.keyDown(container.querySelectorAll('input')[0], { key: 'ArrowDown' }));
    await waitFor(() => fireEvent.click(screen.getAllByLabelText('Select option')[0]));

    expect(screen.getByTestId('duration-number-input')).toHaveValue(parseInt(templateStubs[0].for, 10));
    expect(screen.getByText('Severity')?.parentElement?.nextSibling).toHaveTextContent(
      `${SEVERITY_OPTIONS.find((severity) => severity.value === templateStubs[0].severity)?.label}`
    );
  });

  xit('should show the expression and sample alert when switching templates', async () => {
    const { container } = await waitFor(() => render(<AddAlertRuleModal setVisible={jest.fn()} isVisible />));

    expect(screen.queryByTestId('template-expression')).not.toBeInTheDocument();
    expect(screen.queryByTestId('template-alert')).not.toBeInTheDocument();

    await waitFor(() => fireEvent.keyDown(container.querySelectorAll('input')[0], { key: 'ArrowDown' }));
    await waitFor(() => fireEvent.click(screen.getAllByLabelText('Select option')[0]));

    expect(screen.getByTestId('template-expression').querySelector('pre')).toHaveTextContent(templateStubs[0].expr);
    expect(screen.getByTestId('template-alert').querySelector('pre')?.textContent).toEqual(
      templateStubs[0].annotations?.summary
    );
  });
});
