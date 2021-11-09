import React from 'react';
import { render, screen } from '@testing-library/react';
import { SelectField } from './SelectField';

describe('SelectField', () => {
  it('should render', () => {
    render(<SelectField label="label" name="name" onChange={jest.fn()} />);
    expect(screen.queryByText('label')).toBeInTheDocument();
  });
});
