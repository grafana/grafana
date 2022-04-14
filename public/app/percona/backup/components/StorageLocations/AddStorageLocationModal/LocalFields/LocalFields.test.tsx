import React from 'react';
import { LocalFields } from './LocalFields';
import { render, screen } from '@testing-library/react';
import { Form } from 'react-final-form';

describe('LocalFields', () => {
  it('should pass initial values', () => {
    render(<Form onSubmit={jest.fn()} render={() => <LocalFields name="server" path="/foo" />} />);
    expect(screen.getByRole('textbox')).toHaveValue('/foo');
  });
});
