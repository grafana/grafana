import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import Advanced from './Advanced';

describe('AzureMonitor ResourcePicker', () => {
  it('should set a parameter as an object', async () => {
    const onChange = jest.fn();
    const { rerender } = render(<Advanced onChange={onChange} resource={{}} />);
    const advancedSection = screen.getByText('Advanced');
    advancedSection.click();

    const subsInput = await screen.findByLabelText('Subscription');
    await userEvent.type(subsInput, 'd');
    expect(onChange).toHaveBeenCalledWith({ subscription: 'd' });

    rerender(<Advanced onChange={onChange} resource={{ subscription: 'def-123' }} />);
    expect(screen.getByDisplayValue('def-123')).toBeInTheDocument();
  });

  it('should set a parameter as uri', async () => {
    const onChange = jest.fn();
    const { rerender } = render(<Advanced onChange={onChange} resource={''} />);
    const advancedSection = screen.getByText('Advanced');
    advancedSection.click();

    const subsInput = await screen.findByLabelText('Resource URI');
    await userEvent.type(subsInput, '/');
    expect(onChange).toHaveBeenCalledWith('/');

    rerender(<Advanced onChange={onChange} resource={{ subscription: '/subscriptions/sub' }} />);
    expect(screen.getByDisplayValue('/subscriptions/sub')).toBeInTheDocument();
  });
});
