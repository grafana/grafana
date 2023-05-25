import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import AdvancedResourcePicker from './AdvancedResourcePicker';

describe('AdvancedResourcePicker', () => {
  it('should set a parameter as an object', async () => {
    const onChange = jest.fn();
    const { rerender } = render(<AdvancedResourcePicker onChange={onChange} resources={['']} />);

    const subsInput = await screen.findByTestId('input-advanced-resource-picker-1');
    await userEvent.type(subsInput, 'd');
    expect(onChange).toHaveBeenCalledWith(['d']);

    rerender(<AdvancedResourcePicker onChange={onChange} resources={['/subscriptions/def-123']} />);
    expect(screen.getByDisplayValue('/subscriptions/def-123')).toBeInTheDocument();
  });

  it('should initialize with an empty resource', () => {
    const onChange = jest.fn();
    render(<AdvancedResourcePicker onChange={onChange} resources={[]} />);
    expect(onChange).toHaveBeenCalledWith(['']);
  });

  it('should add a resource', async () => {
    const onChange = jest.fn();
    render(<AdvancedResourcePicker onChange={onChange} resources={['/subscriptions/def-123']} />);
    const addButton = await screen.findByText('Add resource URI');
    addButton.click();
    expect(onChange).toHaveBeenCalledWith(['/subscriptions/def-123', '']);
  });

  it('should remove a resource', async () => {
    const onChange = jest.fn();
    render(<AdvancedResourcePicker onChange={onChange} resources={['/subscriptions/def-123']} />);
    const removeButton = await screen.findByTestId('remove-resource');
    removeButton.click();
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('should render multiple resources', async () => {
    render(
      <AdvancedResourcePicker onChange={jest.fn()} resources={['/subscriptions/def-123', '/subscriptions/def-456']} />
    );

    expect(screen.getByDisplayValue('/subscriptions/def-123')).toBeInTheDocument();
    expect(screen.getByDisplayValue('/subscriptions/def-456')).toBeInTheDocument();
  });
});
