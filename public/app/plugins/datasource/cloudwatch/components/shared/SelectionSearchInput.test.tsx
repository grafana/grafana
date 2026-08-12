import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// eslint-disable-next-line lodash/import-scope
import lodash from 'lodash';

import { SelectionSearchInput } from './SelectionSearchInput';

const defaultProps = {
  ariaLabel: 'selection search',
  placeholder: 'search here',
  searchPhrase: '',
  searchFn: jest.fn(),
};

const originalDebounce = lodash.debounce;

describe('SelectionSearchInput', () => {
  beforeEach(() => {
    lodash.debounce = jest.fn().mockImplementation((fn) => {
      fn.cancel = () => {};
      return fn;
    });
  });

  afterEach(() => {
    lodash.debounce = originalDebounce;
    jest.useRealTimers();
  });

  it('displays the provided search phrase', async () => {
    render(<SelectionSearchInput {...defaultProps} searchPhrase="testPhrase" />);
    expect(await screen.findByDisplayValue('testPhrase')).toBeInTheDocument();
  });

  it('displays the provided placeholder text', async () => {
    render(<SelectionSearchInput {...defaultProps} />);
    expect(await screen.findByPlaceholderText('search here')).toBeInTheDocument();
  });

  it('calls a debounced version of searchFn when typed in', async () => {
    const searchFn = jest.fn();
    render(<SelectionSearchInput {...defaultProps} searchFn={searchFn} />);

    await userEvent.type(await screen.findByLabelText('selection search'), 'something');

    expect(searchFn).toBeCalledWith('s');
    expect(searchFn).toHaveBeenLastCalledWith('something');
  });

  it('keeps a pending search when searchFn changes', () => {
    jest.useFakeTimers();
    lodash.debounce = originalDebounce;
    const initialSearchFn = jest.fn();
    const latestSearchFn = jest.fn();
    const { rerender } = render(<SelectionSearchInput {...defaultProps} searchFn={initialSearchFn} />);

    fireEvent.change(screen.getByLabelText('selection search'), { target: { value: 'something' } });
    rerender(<SelectionSearchInput {...defaultProps} searchFn={latestSearchFn} />);

    act(() => jest.advanceTimersByTime(600));

    expect(initialSearchFn).not.toHaveBeenCalled();
    expect(latestSearchFn).toHaveBeenCalledWith('something');
  });
});
