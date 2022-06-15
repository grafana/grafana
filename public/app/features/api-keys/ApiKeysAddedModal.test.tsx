import { render, screen } from '@testing-library/react';
import React from 'react';

import { ApiKeysAddedModal, Props } from './ApiKeysAddedModal';

describe('ApiKeysAddedModal', () => {
  const props: Props = {
    onDismiss: jest.fn(),
    apiKey: 'myApiKey',
    rootPath: 'test/path',
  };

  it('should render without throwing', () => {
    expect(() => render(<ApiKeysAddedModal {...props} />)).not.toThrow();
  });

  it('displays the apiKey in a readOnly input', () => {
    render(<ApiKeysAddedModal {...props} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue(props.apiKey);
    expect(input).toHaveAttribute('readonly');
  });

  it('has a `Copy to clipboard` button', () => {
    render(<ApiKeysAddedModal {...props} />);
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('displays the correct curl path', () => {
    render(<ApiKeysAddedModal {...props} />);
    expect(
      screen.getByText('curl -H "Authorization: Bearer myApiKey" test/path/api/dashboards/home')
    ).toBeInTheDocument();
  });

  it('calls onDismiss when the modal is closed', () => {
    render(<ApiKeysAddedModal {...props} />);
    screen.getByRole('button', { name: 'Close dialogue' }).click();
    expect(props.onDismiss).toHaveBeenCalled();
  });
});
