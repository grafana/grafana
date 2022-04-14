import React from 'react';
import { SSHKey } from './SSHKey';
import { render, screen, fireEvent } from '@testing-library/react';

describe('SSHKey::', () => {
  it('Renders correctly with props', () => {
    render(<SSHKey sshKey="test key" updateSettings={() => {}} />);

    expect(screen.getByRole('textbox')).toHaveValue('test key');
  });

  it('Disables apply changes on initial values', () => {
    render(<SSHKey sshKey="test key" updateSettings={() => {}} />);

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('Calls apply changes', () => {
    const updateSettings = jest.fn();
    render(<SSHKey sshKey="test key" updateSettings={updateSettings} />);

    const textArea = screen.getByRole('textbox');
    fireEvent.change(textArea, { target: { value: 'new key' } });
    const form = screen.getByTestId('ssh-key-form');
    fireEvent.submit(form);

    expect(updateSettings).toHaveBeenCalled();
  });
});
