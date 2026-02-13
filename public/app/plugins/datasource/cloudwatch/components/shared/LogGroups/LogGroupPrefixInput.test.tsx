import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LOG_GROUP_PREFIX_MAX } from '../../../utils/logGroupsConstants';

import { LogGroupPrefixInput } from './LogGroupPrefixInput';

describe('LogGroupPrefixInput', () => {
  it('should render with label and placeholder', () => {
    render(<LogGroupPrefixInput prefixes={[]} onChange={jest.fn()} />);

    expect(screen.getByText('Prefixes')).toBeInTheDocument();
    expect(screen.getByText(`Add up to ${LOG_GROUP_PREFIX_MAX} prefixes`)).toBeInTheDocument();
  });

  it('should display existing prefixes', () => {
    render(<LogGroupPrefixInput prefixes={['/aws/lambda/', '/aws/rds/']} onChange={jest.fn()} />);

    expect(screen.getByText('/aws/lambda/')).toBeInTheDocument();
    expect(screen.getByText('/aws/rds/')).toBeInTheDocument();
  });

  it('should call onChange when a prefix is added', async () => {
    const onChange = jest.fn();
    render(<LogGroupPrefixInput prefixes={[]} onChange={onChange} />);

    const input = screen.getByRole('combobox');
    await userEvent.type(input, '/aws/lambda/{enter}');

    expect(onChange).toHaveBeenCalledWith(['/aws/lambda/']);
  });

  it('should call onChange when a prefix is removed', async () => {
    const onChange = jest.fn();
    render(<LogGroupPrefixInput prefixes={['/aws/lambda/', '/aws/rds/']} onChange={onChange} />);

    const removeButtons = screen.getAllByRole('button');
    const clearButton = removeButtons.find((btn) => btn.getAttribute('aria-label')?.includes('Remove'));
    if (clearButton) {
      await userEvent.click(clearButton);
      expect(onChange).toHaveBeenCalled();
    }
  });

  it('should be disabled when disabled prop is true', () => {
    render(<LogGroupPrefixInput prefixes={[]} onChange={jest.fn()} disabled={true} />);

    const input = screen.getByLabelText('Log group prefixes');
    expect(input).toBeDisabled();
  });

  it('should show template variables in options', async () => {
    render(
      <LogGroupPrefixInput prefixes={[]} onChange={jest.fn()} variables={['$prefix_var', '$other_var', 'notavar']} />
    );

    const input = screen.getByRole('combobox');
    await userEvent.click(input);

    expect(screen.getByText('$prefix_var')).toBeInTheDocument();
    expect(screen.getByText('$other_var')).toBeInTheDocument();
    expect(screen.queryByText('notavar')).not.toBeInTheDocument();
  });
});
