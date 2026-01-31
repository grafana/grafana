import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LogGroupQueryScopeSelector } from './LogGroupQueryScopeSelector';

describe('LogGroupQueryScopeSelector', () => {
  it('should render all three options', () => {
    render(<LogGroupQueryScopeSelector value="logGroupName" onChange={jest.fn()} />);

    expect(screen.getByRole('radio', { name: 'Log group name' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Name prefix' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'All log groups' })).toBeInTheDocument();
  });

  it('should default to logGroupName when value is undefined', () => {
    render(<LogGroupQueryScopeSelector value={undefined} onChange={jest.fn()} />);

    expect(screen.getByRole('radio', { name: 'Log group name' })).toBeChecked();
  });

  it('should select the correct option based on value', () => {
    render(<LogGroupQueryScopeSelector value="namePrefix" onChange={jest.fn()} />);

    expect(screen.getByRole('radio', { name: 'Name prefix' })).toBeChecked();
  });

  it('should call onChange when an option is selected', async () => {
    const onChange = jest.fn();
    render(<LogGroupQueryScopeSelector value="logGroupName" onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Name prefix' }));

    expect(onChange).toHaveBeenCalledWith('namePrefix');
  });

  it('should be disabled when disabled prop is true', () => {
    render(<LogGroupQueryScopeSelector value="logGroupName" onChange={jest.fn()} disabled={true} />);

    expect(screen.getByRole('radio', { name: 'Log group name' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Name prefix' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'All log groups' })).toBeDisabled();
  });
});
