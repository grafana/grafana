import React from 'react';
import { AddAlertRuleTemplateModal } from './AddAlertRuleTemplateModal';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('../AlertRuleTemplate.service');
jest.mock('app/core/app_events');

describe('AddAlertRuleTemplateModal', () => {
  it('should render component correctly', () => {
    render(<AddAlertRuleTemplateModal setVisible={jest.fn()} getAlertRuleTemplates={jest.fn()} isVisible />);

    expect(screen.getByRole('textbox')).toBeTruthy();
    expect(screen.getByTestId('alert-rule-template-upload-button')).toBeTruthy();
    expect(screen.getByTestId('alert-rule-template-cancel-button')).toBeTruthy();
    expect(screen.getByTestId('alert-rule-template-add-button')).toBeTruthy();
    expect(screen.getByTestId('alert-rule-template-add-button')).toBeDisabled();
  });

  it('should not render modal when visible is set to false', () => {
    render(<AddAlertRuleTemplateModal setVisible={jest.fn()} getAlertRuleTemplates={jest.fn()} isVisible={false} />);

    expect(screen.queryByRole('textarea')).toBeFalsy();
  });

  it('should call setVisible on close', () => {
    const setVisible = jest.fn();
    render(<AddAlertRuleTemplateModal setVisible={setVisible} getAlertRuleTemplates={jest.fn()} isVisible />);

    const background = screen.getByTestId('modal-background');
    fireEvent.click(background);

    expect(setVisible).toHaveBeenCalled();
  });

  it('should call setVisible and getAlertRuleTemplates on submit', async () => {
    const setVisible = jest.fn();
    const getAlertRuleTemplates = jest.fn();
    render(
      <AddAlertRuleTemplateModal setVisible={setVisible} getAlertRuleTemplates={getAlertRuleTemplates} isVisible />
    );

    const textbox = screen.getByRole('textbox');
    fireEvent.change(textbox, { target: { value: 'test content' } });

    const form = screen.getByTestId('add-alert-rule-template-modal-form');
    await waitFor(() => fireEvent.submit(form));

    expect(setVisible).toHaveBeenCalledWith(false);
    expect(getAlertRuleTemplates).toHaveBeenCalled();
  });
});
