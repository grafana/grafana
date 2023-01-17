import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import Advanced from './Advanced';

describe('AzureMonitor ResourcePicker', () => {
  it('should set a parameter as an object', async () => {
    const onChange = jest.fn();
    const { rerender } = render(<Advanced onChange={onChange} resources={[{}]} />);
    const advancedSection = screen.getByText('Advanced');
    advancedSection.click();

    const subsInput = await screen.findByLabelText('Subscription');
    await userEvent.type(subsInput, 'd');
    expect(onChange).toHaveBeenCalledWith([{ subscription: 'd' }]);

    rerender(<Advanced onChange={onChange} resources={[{ subscription: 'def-123' }]} />);
    expect(screen.getByLabelText('Subscription').outerHTML).toMatch('value="def-123"');
  });

  it('should set a parameter as uri', async () => {
    const onChange = jest.fn();
    const { rerender } = render(<Advanced onChange={onChange} resources={['']} />);
    const advancedSection = screen.getByText('Advanced');
    advancedSection.click();

    const subsInput = await screen.findByLabelText('Resource URI');
    await userEvent.type(subsInput, '/');
    expect(onChange).toHaveBeenCalledWith(['/']);

    rerender(<Advanced onChange={onChange} resources={['/subscriptions/sub']} />);
    expect(screen.getByLabelText('Resource URI').outerHTML).toMatch('value="/subscriptions/sub"');
  });

  it('should render multiple resources', async () => {
    render(<Advanced onChange={jest.fn()} resources={['/subscriptions/sub1', '/subscriptions/sub2']} />);
    const advancedSection = screen.getByText('Advanced');
    advancedSection.click();

    expect(screen.getByDisplayValue('/subscriptions/sub1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('/subscriptions/sub2')).toBeInTheDocument();
  });
});
