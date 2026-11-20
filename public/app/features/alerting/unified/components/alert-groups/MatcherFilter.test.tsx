import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';

import * as analytics from '../../Analytics';

import { MatcherFilter } from './MatcherFilter';

const logInfoSpy = jest.spyOn(analytics, 'logInfo');

describe('Analytics', () => {
  it('Sends log info when filtering alert instances by label', async () => {
    render(<MatcherFilter onFilterChange={jest.fn()} />);

    const searchInput = screen.getByTestId(selectors.pages.Alerting.searchInput);
    await userEvent.type(searchInput, 'job=', { delay: 600 }); // Delay waits for the MatcherFilter debounce

    expect(logInfoSpy).toHaveBeenCalledWith(analytics.LogMessages.filterByLabel);
  });

  it('should call onChange handler', async () => {
    const onFilterMock = jest.fn();

    render(<MatcherFilter defaultQueryString="foo" onFilterChange={onFilterMock} />);

    const searchInput = screen.getByTestId(selectors.pages.Alerting.searchInput);
    await userEvent.type(searchInput, '=bar', { delay: 600 }); // Delay waits for the MatcherFilter debounce

    expect(onFilterMock).toHaveBeenLastCalledWith('foo=bar');
  });
});
