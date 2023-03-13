import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// eslint-disable-next-line lodash/import-scope
import lodash from 'lodash';
import React from 'react';

import Search from '../Search';

const defaultProps = {
  searchPhrase: '',
  searchFn: jest.fn(),
};
const originalDebounce = lodash.debounce;

describe('Search', () => {
  beforeEach(() => {
    lodash.debounce = jest.fn().mockImplementation((fn) => {
      fn.cancel = () => {};
      return fn;
    });
  });
  afterEach(() => {
    lodash.debounce = originalDebounce;
  });
  it('displays the search phrase passed in if it exists', async () => {
    render(<Search {...defaultProps} searchPhrase={'testPhrase'} />);
    expect(await screen.findByDisplayValue('testPhrase')).toBeInTheDocument();
  });

  it('displays placeholder text if search phrase is not passed in', async () => {
    render(<Search {...defaultProps} />);
    expect(await screen.findByPlaceholderText('search by log group name prefix')).toBeInTheDocument();
  });

  it('calls a debounced version of searchFn when typed in', async () => {
    const searchFn = jest.fn();
    render(<Search {...defaultProps} searchFn={searchFn} />);
    await userEvent.type(await screen.findByLabelText('log group search'), 'something');
    expect(searchFn).toBeCalledWith('s');
    expect(searchFn).toHaveBeenLastCalledWith('something');
  });
});
