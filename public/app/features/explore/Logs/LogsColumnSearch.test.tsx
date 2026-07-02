import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { render } from '../../../../test/test-utils';

import { LogsColumnSearch } from './LogsColumnSearch';

describe('LogsColumnSearch', () => {
  it('should render with the provided value', () => {
    render(<LogsColumnSearch value="test-value" onChange={jest.fn()} />);
    expect(screen.getByPlaceholderText('Search fields by name')).toHaveValue('test-value');
  });

  it('should render with empty value', () => {
    render(<LogsColumnSearch value="" onChange={jest.fn()} />);
    expect(screen.getByPlaceholderText('Search fields by name')).toHaveValue('');
  });

  it('should call onChange when user types', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(<LogsColumnSearch value="" onChange={onChange} />);

    await user.type(screen.getByPlaceholderText('Search fields by name'), 'a');
    expect(onChange).toHaveBeenCalled();
  });
});
