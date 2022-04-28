import React from 'react';
import { Provider } from 'react-redux';
import { StoreState } from 'app/types';
import { configureStore } from 'app/store/configureStore';
import { AlertRuleTemplate } from './AlertRuleTemplate';
import { fireEvent, render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import { AlertRuleTemplateService } from './AlertRuleTemplate.service';

jest.mock('./AlertRuleTemplate.service');
jest.mock('@percona/platform-core', () => {
  const originalModule = jest.requireActual('@percona/platform-core');
  return {
    ...originalModule,
    logger: {
      error: jest.fn(),
    },
  };
});

describe('AlertRuleTemplate', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render add modal', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: true } },
          },
        } as StoreState)}
      >
        <AlertRuleTemplate />
      </Provider>
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));

    expect(screen.queryByTestId('modal-wrapper')).not.toBeInTheDocument();
    const button = screen.getByTestId('alert-rule-template-add-modal-button');
    fireEvent.click(button);
    expect(screen.getByTestId('modal-wrapper')).toBeInTheDocument();
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
        <AlertRuleTemplate />
      </Provider>
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));

    expect(screen.getByTestId('table-thead').querySelectorAll('tr')).toHaveLength(1);
    expect(screen.getByTestId('table-tbody').querySelectorAll('tr')).toHaveLength(5);
    expect(screen.queryByTestId('table-no-data')).not.toBeInTheDocument();
  });

  it('should render correctly without data', async () => {
    jest.spyOn(AlertRuleTemplateService, 'list').mockImplementation(() => {
      throw Error('test error');
    });

    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: true } },
          },
        } as StoreState)}
      >
        <AlertRuleTemplate />
      </Provider>
    );

    expect(screen.queryByTestId('table-thead')).not.toBeInTheDocument();
    expect(screen.queryByTestId('table-tbody')).not.toBeInTheDocument();
    expect(screen.getByTestId('table-no-data')).toBeInTheDocument();
  });
});
