import { render, screen } from '@testing-library/react';
import React from 'react';
import { Form } from 'react-final-form';

import { EmailFields } from './EmailFields';

describe('EmailFields', () => {
  it('should render correct fields', () => {
    render(<Form onSubmit={jest.fn()} render={() => <EmailFields />} />);

    expect(screen.getByTestId('emails-textarea-input')).toBeInTheDocument();
  });
});
