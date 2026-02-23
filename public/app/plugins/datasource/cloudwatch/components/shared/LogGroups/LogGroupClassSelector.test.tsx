import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LogGroupClassSelector } from './LogGroupClassSelector';

describe('LogGroupClassSelector', () => {
  it('should render both class options', () => {
    render(<LogGroupClassSelector value="STANDARD" onChange={jest.fn()} />);

    expect(screen.getByRole('radio', { name: 'Standard' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Infrequent Access' })).toBeInTheDocument();
  });

  it('should default to STANDARD when value is undefined', () => {
    render(<LogGroupClassSelector value={undefined} onChange={jest.fn()} />);

    expect(screen.getByRole('radio', { name: 'Standard' })).toBeChecked();
  });

  it('should select the correct option based on value', () => {
    render(<LogGroupClassSelector value="INFREQUENT_ACCESS" onChange={jest.fn()} />);

    expect(screen.getByRole('radio', { name: 'Infrequent Access' })).toBeChecked();
  });

  it('should call onChange when an option is selected', async () => {
    const onChange = jest.fn();
    render(<LogGroupClassSelector value="STANDARD" onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Infrequent Access' }));

    expect(onChange).toHaveBeenCalledWith('INFREQUENT_ACCESS');
  });

  it('should be disabled when disabled prop is true', () => {
    render(<LogGroupClassSelector value="STANDARD" onChange={jest.fn()} disabled={true} />);

    expect(screen.getByRole('radio', { name: 'Standard' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Infrequent Access' })).toBeDisabled();
  });
});
