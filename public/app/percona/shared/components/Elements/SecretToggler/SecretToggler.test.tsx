import React from 'react';
import { Icon } from '@grafana/ui';
import { SecretToggler } from './SecretToggler';
import { render, screen, fireEvent } from '@testing-library/react';
import { Form } from 'react-final-form';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  Icon: jest.fn((props) => <div data-testid="icon" {...props} />),
}));

describe('SecretToggler', () => {
  it('should render hidden characters by default', () => {
    render(<Form onSubmit={jest.fn()} render={() => <SecretToggler small secret="secret" />} />);

    expect(screen.getByTestId('small-secret-holder')).toHaveTextContent('******');
  });

  it('should show the eye icon when not showing text', () => {
    render(<Form onSubmit={jest.fn()} render={() => <SecretToggler secret="secret" />} />);
    expect(Icon).toHaveBeenCalledWith(expect.objectContaining({ name: 'eye' }), expect.anything());
  });

  it('should reveal the secret when the eye is clicked', () => {
    render(<Form onSubmit={jest.fn()} render={() => <SecretToggler small secret="secret" />} />);

    const icon = screen.getByTestId('icon');
    expect(Icon).toHaveBeenCalledWith(expect.objectContaining({ name: 'eye' }), expect.anything());
    fireEvent.click(icon);
    expect(Icon).toHaveBeenCalledWith(expect.objectContaining({ name: 'eye-slash' }), expect.anything());

    expect(screen.getByTestId('small-secret-holder')).toHaveTextContent('secret');
  });

  it('should show a TextInputField when not small', () => {
    render(<Form onSubmit={jest.fn()} render={() => <SecretToggler secret="secret" />} />);
    expect(screen.getByTestId('secret-text-input')).toBeInTheDocument();
  });
});
