import React from 'react';
import { Form } from 'react-final-form';
import { EmailFields } from './EmailFields';
import { render, screen } from '@testing-library/react';

describe('EmailFields', () => {
  it('should render correct fields', () => {
    render(<Form onSubmit={jest.fn()} render={() => <EmailFields />} />);

    expect(screen.getByTestId('emails-textarea-input')).toBeInTheDocument();
  });
});
