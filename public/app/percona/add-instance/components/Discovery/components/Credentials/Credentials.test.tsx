import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import Credentials from './Credentials';

describe('Credentials:: ', () => {
  it('should render access and secret keys fields', () => {
    render(<Credentials discover={jest.fn()} />);

    expect(screen.getByTestId('aws_access_key-text-input')).toBeInTheDocument();
    expect(screen.getByTestId('aws_secret_key-password-input')).toBeInTheDocument();
  });

  it('should call discover on submit', () => {
    const discover = jest.fn();
    render(<Credentials discover={discover} />);

    const form = screen.getByTestId('credentials-form');
    fireEvent.submit(form);

    expect(discover).toHaveBeenCalled();
  });
});
