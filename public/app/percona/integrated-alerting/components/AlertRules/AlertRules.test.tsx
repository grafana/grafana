import React from 'react';
import { AlertRules } from './AlertRules';
import { AlertRuleTemplateService } from '../AlertRuleTemplate/AlertRuleTemplate.service';
import { NotificationChannelService } from '../NotificationChannel/NotificationChannel.service';
import { NotificationChannelType } from '../NotificationChannel/NotificationChannel.types';
import { templateStubs } from '../AlertRuleTemplate/__mocks__/alertRuleTemplateStubs';
import { AlertRulesService } from './AlertRules.service';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const notificationChannelsServiceList = jest.spyOn(NotificationChannelService, 'list').mockImplementation(() =>
  Promise.resolve({
    totals: {
      total_items: 2,
      total_pages: 1,
    },
    channels: [
      {
        type: NotificationChannelType.email,
        channelId: 'testId',
        summary: 'test',
        disabled: false,
      },
      {
        type: NotificationChannelType.email,
        channelId: 'testId',
        summary: 'test',
        disabled: false,
      },
    ],
  })
);

const alertRuleTemplateServiceList = jest.spyOn(AlertRuleTemplateService, 'list').mockImplementation(() =>
  Promise.resolve({
    templates: templateStubs,
    totals: { total_items: 4, total_pages: 1 },
  })
);

jest.mock('./AlertRules.service');

describe('AlertRules', () => {
  it('gets the templates when mounted', async () => {
    expect(alertRuleTemplateServiceList).toBeCalledTimes(0);
    expect(notificationChannelsServiceList).toBeCalledTimes(0);

    await waitFor(() => render(<AlertRules />));

    expect(alertRuleTemplateServiceList).toBeCalledTimes(1);
    expect(notificationChannelsServiceList).toBeCalledTimes(1);
  });

  it('should toggle selected alert rule details', async () => {
    await waitFor(() => render(<AlertRules />));

    const showDetails = screen.getAllByTestId('show-details')[0];
    await waitFor(() => fireEvent.click(showDetails));

    expect(screen.getByTestId('alert-rules-details')).toBeInTheDocument();

    const hideDetails = screen.getByTestId('hide-details');
    await waitFor(() => fireEvent.click(hideDetails));

    expect(screen.queryByTestId('alert-rules-details')).not.toBeInTheDocument();
  });

  it('should have table initially loading', async () => {
    render(<AlertRules />);

    expect(screen.getByTestId('table-loading')).toBeInTheDocument();
    expect(screen.getByTestId('table-no-data')).toBeInTheDocument();
  });

  it('should render table content', async () => {
    await waitFor(() => render(<AlertRules />));

    expect(screen.getByTestId('table-thead').querySelectorAll('tr')).toHaveLength(1);
    expect(screen.getByTestId('table-tbody').querySelectorAll('tr')).toHaveLength(6);
    expect(screen.queryByTestId('table-no-data')).not.toBeInTheDocument();
  });
  it('should render correctly without data', async () => {
    jest
      .spyOn(AlertRulesService, 'list')
      .mockReturnValueOnce(Promise.resolve({ rules: [], totals: { total_items: 0, total_pages: 0 } }));

    await waitFor(() => render(<AlertRules />));

    expect(screen.getByTestId('table-no-data')).toBeInTheDocument();
  });
});
