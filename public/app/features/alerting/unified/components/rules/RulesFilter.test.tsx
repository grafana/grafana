import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { logInfo } from '@grafana/runtime';

import { LogMessages } from '../../Analytics';

import RulesFilter from './RulesFilter';

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  return {
    ...original,
    logInfo: jest.fn(),
    DataSourcePicker: () => <></>,
  };
});

jest.mock('react-router-dom', () => ({
  useLocation: () => ({
    pathname: 'localhost:3000/example/path',
  }),
}));

jest.mock('../../utils/misc', () => ({
  getFiltersFromUrlParams: jest.fn(() => ({ dataSource: {}, alertState: {}, queryString: '', ruleType: '' })),
}));

describe('Analytics', () => {
  it('Sends log info when clicking alert state filters', async () => {
    render(<RulesFilter />);

    const button = screen.getByText('Pending');

    await userEvent.click(button);

    expect(logInfo).toHaveBeenCalledWith(LogMessages.clickingAlertStateFilters);
  });
});
