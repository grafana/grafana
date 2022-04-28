import React from 'react';
import { Provider } from 'react-redux';
import { StoreState } from 'app/types';
import { configureStore } from 'app/store/configureStore';
import { fireEvent, render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import { AlertRules } from './AlertRules';
import { AlertRuleTemplateService } from '../AlertRuleTemplate/AlertRuleTemplate.service';
import { NotificationChannelService } from '../NotificationChannel/NotificationChannel.service';
import { NotificationChannelType } from '../NotificationChannel/NotificationChannel.types';
import { templateStubs } from '../AlertRuleTemplate/__mocks__/alertRuleTemplateStubs';
import { AlertRulesService } from './AlertRules.service';

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

    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: true } },
          },
        } as StoreState)}
      >
        <AlertRules />
      </Provider>
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));
    expect(alertRuleTemplateServiceList).toBeCalledTimes(1);
    expect(notificationChannelsServiceList).toBeCalledTimes(1);
  });

  it('should toggle selected alert rule details', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: true } },
          },
        } as StoreState)}
      >
        <AlertRules />
      </Provider>
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));
    fireEvent.click(screen.getAllByTestId('show-details')[0]);
    expect(screen.getAllByTestId('alert-rules-details')).toHaveLength(1);
    fireEvent.click(screen.getAllByTestId('hide-details')[0]);
    expect(screen.queryByTestId('alert-rules-details')).not.toBeInTheDocument();
  });

  it('should render table content', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: true } },
          },
        } as StoreState)}
      >
        <AlertRules />
      </Provider>
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));

    expect(screen.getAllByRole('row')).toHaveLength(1 + 6);
    expect(screen.queryByTestId('table-no-data')).not.toBeInTheDocument();
  });
  it('should render correctly without data', async () => {
    jest
      .spyOn(AlertRulesService, 'list')
      .mockReturnValueOnce(Promise.resolve({ rules: [], totals: { total_items: 0, total_pages: 0 } }));

    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: true } },
          },
        } as StoreState)}
      >
        <AlertRules />
      </Provider>
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByTestId('table-no-data')).toBeInTheDocument();
  });
});
