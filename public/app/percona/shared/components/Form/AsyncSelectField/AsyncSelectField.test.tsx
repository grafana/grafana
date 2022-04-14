import React from 'react';
import { AsyncSelectField } from './AsyncSelectField';
import { render, screen } from '@testing-library/react';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  AsyncSelect: jest.fn(() => <div data-testid="async-select" />),
}));

describe('AsyncSelectField', () => {
  it('should render', () => {
    render(<AsyncSelectField label="label" name="name" onChange={jest.fn()} />);
    expect(screen.getByTestId('name-select-label')).toBeInTheDocument();
    expect(screen.getByTestId('async-select')).toBeInTheDocument();
  });
});
