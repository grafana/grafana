import React from 'react';
import { render, screen } from '@testing-library/react';
import { MultiSelectField } from './MultiSelectField';

describe('MultiSelectField', () => {
  it('should render', () => {
    render(<MultiSelectField label="label" name="name" onChange={jest.fn()} />);
    expect(screen.queryByText('label')).toBeInTheDocument();
  });
});
