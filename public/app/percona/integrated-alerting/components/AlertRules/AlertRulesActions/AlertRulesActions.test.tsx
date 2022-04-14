import React from 'react';
import { AlertRulesActions } from './AlertRulesActions';
import { formattedRulesStubs } from '../__mocks__/alertRulesStubs';
import { AlertRulesProvider } from '../AlertRules.provider';
import { AlertRulesContext } from '../AlertRules.types';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockContext = () => ({
  setAddModalVisible: jest.fn(),
  setSelectedAlertRule: jest.fn(),
  getAlertRules: jest.fn(),
});
jest.mock('../AlertRules.service');
jest.mock('app/core/core', () => ({
  appEvents: {
    emit: jest.fn(),
  },
}));
const withContext = (values: AlertRulesContext, wrapper: JSX.Element) => (
  <AlertRulesProvider.Provider value={values}>{wrapper}</AlertRulesProvider.Provider>
);

describe('AlertRulesActions', () => {
  it('calls the API to update an alert rule on edit', async () => {
    const context = mockContext();
    render(withContext(context, <AlertRulesActions alertRule={formattedRulesStubs[0]} />));

    const editAlertRuleButton = screen.getAllByTestId('edit-alert-rule-button')[0];
    fireEvent.click(editAlertRuleButton);

    expect(context.setSelectedAlertRule).toBeCalledTimes(1);
  });

  it('calls the API to delete an alert rule', async () => {
    render(withContext(mockContext(), <AlertRulesActions alertRule={formattedRulesStubs[1]} />));

    expect(screen.queryByTestId('modal-wrapper')).not.toBeInTheDocument();

    const deleteAlertRuleButton = screen.getAllByTestId('delete-alert-rule-button')[0];
    fireEvent.click(deleteAlertRuleButton);

    expect(screen.getByTestId('modal-wrapper')).toBeInTheDocument();
  });

  it('renders an enabled switch for an enabled alert rule', () => {
    render(withContext(mockContext(), <AlertRulesActions alertRule={formattedRulesStubs[0]} />));
    expect(screen.getByTestId('toggle-alert-rule')).toHaveProperty('checked', true);
  });

  it('renders a disabled switch for a disabled alert rule', () => {
    render(withContext(mockContext(), <AlertRulesActions alertRule={{ ...formattedRulesStubs[0], disabled: true }} />));
    expect(screen.getByTestId('toggle-alert-rule')).toHaveProperty('checked', false);
  });

  it('calls getAlertRules on toggle', async () => {
    const context = mockContext();
    render(withContext(context, <AlertRulesActions alertRule={formattedRulesStubs[0]} />));
    const toggleAlertRule = screen.getByTestId('toggle-alert-rule');
    await waitFor(() => fireEvent.click(toggleAlertRule));
    expect(context.getAlertRules).toHaveBeenCalled();
  });
});
