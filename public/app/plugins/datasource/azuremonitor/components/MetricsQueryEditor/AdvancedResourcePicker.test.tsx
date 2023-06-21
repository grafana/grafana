import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import AdvancedResourcePicker from './AdvancedResourcePicker';

describe('AdvancedResourcePicker', () => {
  it('should set a parameter as an object', async () => {
    const onChange = jest.fn();
    const { rerender } = render(<AdvancedResourcePicker onChange={onChange} resources={[{}]} />);

    const subsInput = await screen.findByLabelText('Subscription');
    await userEvent.type(subsInput, 'd');
    expect(onChange).toHaveBeenCalledWith([{ subscription: 'd' }]);

    rerender(<AdvancedResourcePicker onChange={onChange} resources={[{ subscription: 'def-123' }]} />);
    expect(screen.getByLabelText('Subscription').outerHTML).toMatch('value="def-123"');
  });

  it('should initialize with an empty resource', () => {
    const onChange = jest.fn();
    render(<AdvancedResourcePicker onChange={onChange} resources={[]} />);
    expect(onChange).toHaveBeenCalledWith([{}]);
  });

  it('should add a resource', async () => {
    const onChange = jest.fn();
    render(<AdvancedResourcePicker onChange={onChange} resources={[{ subscription: 'def-123' }]} />);
    const addButton = await screen.findByText('Add resource');
    addButton.click();
    expect(onChange).toHaveBeenCalledWith([
      { subscription: 'def-123' },
      { subscription: 'def-123', resourceGroup: '', resourceName: '' },
    ]);
  });

  it('should remove a resource', async () => {
    const onChange = jest.fn();
    render(<AdvancedResourcePicker onChange={onChange} resources={[{ subscription: 'def-123' }]} />);
    const removeButton = await screen.findByTestId('remove-resource');
    removeButton.click();
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('should update all resources when editing the subscription', async () => {
    const onChange = jest.fn();
    render(
      <AdvancedResourcePicker
        onChange={onChange}
        resources={[{ subscription: 'def-123' }, { subscription: 'def-123' }]}
      />
    );
    const subsInput = await screen.findByLabelText('Subscription');
    await userEvent.type(subsInput, 'd');
    expect(onChange).toHaveBeenCalledWith([{ subscription: 'def-123d' }, { subscription: 'def-123d' }]);
  });

  it('should update all resources when editing the namespace', async () => {
    const onChange = jest.fn();
    render(
      <AdvancedResourcePicker onChange={onChange} resources={[{ metricNamespace: 'aa' }, { metricNamespace: 'aa' }]} />
    );
    const subsInput = await screen.findByLabelText('Namespace');
    await userEvent.type(subsInput, 'b');
    expect(onChange).toHaveBeenCalledWith([{ metricNamespace: 'aab' }, { metricNamespace: 'aab' }]);
  });

  it('should update all resources when editing the region', async () => {
    const onChange = jest.fn();
    render(<AdvancedResourcePicker onChange={onChange} resources={[{ region: 'aa' }, { region: 'aa' }]} />);
    const subsInput = await screen.findByLabelText('Region');
    await userEvent.type(subsInput, 'b');
    expect(onChange).toHaveBeenCalledWith([{ region: 'aab' }, { region: 'aab' }]);
  });

  it('should render multiple resources', async () => {
    render(
      <AdvancedResourcePicker
        onChange={jest.fn()}
        resources={[
          {
            subscription: 'sub1',
            metricNamespace: 'ns1',
            resourceGroup: 'rg1',
            resourceName: 'res1',
          },
          {
            subscription: 'sub1',
            metricNamespace: 'ns1',
            resourceGroup: 'rg2',
            resourceName: 'res2',
          },
        ]}
      />
    );

    expect(screen.getByDisplayValue('sub1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ns1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('rg1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('res1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('rg2')).toBeInTheDocument();
    expect(screen.getByDisplayValue('res2')).toBeInTheDocument();
  });
});
