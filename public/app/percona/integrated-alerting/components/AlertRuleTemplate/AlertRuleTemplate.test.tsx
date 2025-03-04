import { fireEvent, render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';

import { config, locationService } from '@grafana/runtime';
import { wrapWithGrafanaContextMock } from 'app/percona/shared/helpers/testUtils';
import { configureStore } from 'app/store/configureStore';
import { OrgRole, StoreState } from 'app/types';

import { AlertRuleTemplate } from './AlertRuleTemplate';
import { AlertRuleTemplateService } from './AlertRuleTemplate.service';

jest.mock('./AlertRuleTemplate.service');
jest.mock('app/percona/shared/helpers/logger', () => {
  const originalModule = jest.requireActual('app/percona/shared/helpers/logger');
  return {
    ...originalModule,
    logger: {
      error: jest.fn(),
    },
  };
});

describe('AlertRuleTemplate', () => {
  beforeEach(() => {
    config.bootData.user.orgRole = OrgRole.Admin;
  });

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
        {wrapWithGrafanaContextMock(
          <Router history={locationService.getHistory()}>
            <AlertRuleTemplate />
          </Router>
        )}
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
        {wrapWithGrafanaContextMock(
          <Router history={locationService.getHistory()}>
            <AlertRuleTemplate />
          </Router>
        )}
      </Provider>
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));

    expect(screen.getByTestId('table-thead').querySelectorAll('tr')).toHaveLength(1);
    expect(screen.getByTestId('table-tbody').querySelectorAll('tr')).toHaveLength(6);
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
        {wrapWithGrafanaContextMock(
          <Router history={locationService.getHistory()}>
            <AlertRuleTemplate />
          </Router>
        )}
      </Provider>
    );

    expect(screen.queryByTestId('table-thead')).not.toBeInTheDocument();
    expect(screen.queryByTestId('table-tbody')).not.toBeInTheDocument();
    expect(screen.getByTestId('table-no-data')).toBeInTheDocument();
  });

  it('should be accessible to editor', async () => {
    config.bootData.user.isGrafanaAdmin = false;
    config.bootData.user.orgRole = OrgRole.Editor;

    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: false },
            settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: true } },
          },
        } as StoreState)}
      >
        {wrapWithGrafanaContextMock(
          <Router history={locationService.getHistory()}>
            <AlertRuleTemplate />
          </Router>
        )}
      </Provider>
    );

    expect(screen.queryByTestId('unauthorized')).not.toBeInTheDocument();
  });

  it("shouldn't be accessible to viewer", () => {
    config.bootData.user.isGrafanaAdmin = false;
    config.bootData.user.orgRole = OrgRole.Viewer;

    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: false },
            settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: true } },
          },
        } as StoreState)}
      >
        {wrapWithGrafanaContextMock(
          <Router history={locationService.getHistory()}>
            <AlertRuleTemplate />
          </Router>
        )}
      </Provider>
    );

    expect(screen.queryByTestId('unauthorized')).toBeInTheDocument();
  });
});
