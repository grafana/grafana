import React from 'react';
import { AlertManager } from './AlertManager';
import { render, screen, fireEvent } from '@testing-library/react';

describe('AlertManager::', () => {
  it('Renders correctly with props', () => {
    render(<AlertManager alertManagerUrl="test url" alertManagerRules="test rules" updateSettings={() => {}} />);
    expect(screen.getByTestId('alertmanager-url')).toHaveValue('test url');
    expect(screen.getAllByRole('textbox')[1]).toHaveTextContent('test rules');
  });

  it('Disables apply changes on initial values', () => {
    render(<AlertManager alertManagerUrl="" alertManagerRules="" updateSettings={() => {}} />);

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('Calls apply changes', () => {
    const updateSettings = jest.fn();
    render(<AlertManager alertManagerUrl="test url" alertManagerRules="test rules" updateSettings={updateSettings} />);

    const textarea = screen.getAllByRole('textbox')[1];
    fireEvent.change(textarea, { target: { value: 'new key' } });
    const form = screen.getByTestId('alert-manager-form');
    fireEvent.submit(form);

    expect(updateSettings).toHaveBeenCalled();
  });
});
