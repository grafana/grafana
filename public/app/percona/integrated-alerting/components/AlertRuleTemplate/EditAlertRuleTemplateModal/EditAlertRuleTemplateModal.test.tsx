import React from 'react';
import { EditAlertRuleTemplateModal } from './EditAlertRuleTemplateModal';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('../AlertRuleTemplate.service');
jest.mock('app/core/app_events');

describe('EditAlertRuleTemplateModal', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render component correctly', () => {
    const { container } = render(
      <EditAlertRuleTemplateModal
        name="template-1"
        summary="summary"
        setVisible={jest.fn()}
        isVisible
        yaml=""
        getAlertRuleTemplates={jest.fn()}
      />
    );
    const addButton = screen.getByTestId('alert-rule-template-edit-button');

    expect(container.querySelector('textarea')).toBeTruthy();
    expect(addButton).toBeInTheDocument();
    expect(addButton).toBeDisabled();
    expect(screen.getByTestId('alert-rule-template-cancel-button')).toBeInTheDocument();
    expect(screen.getByTestId('alert-rule-name-warning')).toBeInTheDocument();
  });

  it('should not render modal when visible is set to false', () => {
    const { container } = render(
      <EditAlertRuleTemplateModal
        name="template-1"
        summary="summary"
        setVisible={jest.fn()}
        isVisible={false}
        yaml=""
        getAlertRuleTemplates={jest.fn()}
      />
    );

    expect(container.querySelector('textarea')).not.toBeInTheDocument();
  });

  it('should call setVisible on close', () => {
    const setVisible = jest.fn();
    render(
      <EditAlertRuleTemplateModal
        name="template-1"
        summary="summary"
        setVisible={setVisible}
        isVisible
        yaml=""
        getAlertRuleTemplates={jest.fn()}
      />
    );

    const background = screen.getByTestId('modal-background');
    fireEvent.click(background);

    expect(setVisible).toHaveBeenCalled();
  });

  it('should render yaml content passed', () => {
    const { container } = render(
      <EditAlertRuleTemplateModal
        name="template-1"
        summary="summary"
        setVisible={jest.fn()}
        isVisible
        yaml="test content"
        getAlertRuleTemplates={jest.fn()}
      />
    );
    expect(container.querySelector('textarea')).toHaveTextContent('test content');
    expect(screen.getByTestId('alert-rule-template-edit-button')).toBeDisabled();
  });

  it('should call setVisible and getAlertRuleTemplates on submit', async () => {
    const setVisible = jest.fn();
    const getAlertRuleTemplates = jest.fn();
    render(
      <EditAlertRuleTemplateModal
        name="template-1"
        summary="summary"
        setVisible={setVisible}
        isVisible
        yaml=""
        getAlertRuleTemplates={getAlertRuleTemplates}
      />
    );

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'test content' } });

    const form = screen.getByTestId('edit-alert-rule-template-form');
    await waitFor(() => fireEvent.submit(form));

    expect(setVisible).toHaveBeenCalledWith(false);
    expect(getAlertRuleTemplates).toHaveBeenCalled();
  });
});
