import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import lodash from 'lodash'; // eslint-disable-line lodash/import-scope
import React from 'react';

import { logInfo } from '@grafana/runtime';

import { LogMessages } from '../../Analytics';

import { MatcherFilter } from './MatcherFilter';

jest.mock('@grafana/runtime');

describe('Analytics', () => {
  it('Sends log info when filtering alert instances by label', async () => {
    lodash.debounce = jest.fn().mockImplementation((fn) => fn);

    render(<MatcherFilter onFilterChange={jest.fn()} />);

    const searchInput = screen.getByTestId('search-query-input');
    await userEvent.type(searchInput, 'job=');

    expect(logInfo).toHaveBeenCalledWith(LogMessages.filterByLabel);
  });

  it('should call onChange handler', async () => {
    lodash.debounce = jest.fn().mockImplementation((fn) => fn);
    const onFilterMock = jest.fn();

    render(<MatcherFilter defaultQueryString="foo" onFilterChange={onFilterMock} />);

    const searchInput = screen.getByTestId('search-query-input');
    await userEvent.type(searchInput, '=bar');

    expect(onFilterMock).toHaveBeenLastCalledWith('foo=bar');
  });
});
