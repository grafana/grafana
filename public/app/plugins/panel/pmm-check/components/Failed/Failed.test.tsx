import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { config } from '@grafana/runtime';
import { CheckService } from 'app/percona/check/Check.service';
import { configureStore } from 'app/store/configureStore';
import { OrgRole, StoreState } from 'app/types';

import { Failed } from './Failed';

jest.mock('app/percona/check/Check.service');

const spyGetAllFailedChecks = jest.spyOn(CheckService, 'getAllFailedChecks');

describe('Failed::', () => {
  beforeEach(() => {
    config.bootData.user.isGrafanaAdmin = true;
    config.bootData.user.orgRole = OrgRole.Admin;
    spyGetAllFailedChecks.mockClear();
  });

  it('should render a sum of total failed checks with severity details for admin user', async () => {
    spyGetAllFailedChecks.mockImplementationOnce(async () => [
      {
        serviceName: '',
        serviceId: '',
        counts: {
          emergency: 0,
          critical: 1,
          alert: 0,
          error: 0,
          warning: 2,
          notice: 0,
          info: 0,
          debug: 0,
        },
      },
      {
        serviceName: '',
        serviceId: '',
        counts: {
          emergency: 0,
          critical: 2,
          alert: 0,
          error: 0,
          warning: 0,
          notice: 0,
          info: 0,
          debug: 0,
        },
      },
    ]);

    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { advisorEnabled: true, isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <Failed />
      </Provider>
    );

    await waitFor(() => expect(CheckService.getAllFailedChecks).toHaveBeenCalled());

    await waitFor(() => expect(screen.getByTestId('db-check-panel-critical').textContent).toEqual('3'));
    await waitFor(() => expect(screen.getByTestId('db-check-panel-error').textContent).toEqual('0'));
    await waitFor(() => expect(screen.getByTestId('db-check-panel-warning').textContent).toEqual('2'));
    await waitFor(() => expect(screen.getByTestId('db-check-panel-notice').textContent).toEqual('0'));
  });

  it('should render a sum of total failed checks with severity details for editor user', async () => {
    config.bootData.user.isGrafanaAdmin = false;
    config.bootData.user.orgRole = OrgRole.Editor;
    spyGetAllFailedChecks.mockImplementationOnce(async () => [
      {
        serviceName: '',
        serviceId: '',
        counts: {
          emergency: 0,
          critical: 1,
          alert: 0,
          error: 0,
          warning: 2,
          notice: 0,
          info: 0,
          debug: 0,
        },
      },
      {
        serviceName: '',
        serviceId: '',
        counts: {
          emergency: 0,
          critical: 2,
          alert: 0,
          error: 0,
          warning: 0,
          notice: 0,
          info: 0,
          debug: 0,
        },
      },
    ]);

    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: false },
            settings: { loading: false, result: { advisorEnabled: true, isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <Failed />
      </Provider>
    );

    await waitFor(() => expect(CheckService.getAllFailedChecks).toHaveBeenCalled());

    await waitFor(() => expect(screen.getByTestId('db-check-panel-critical').textContent).toEqual('3'));
    await waitFor(() => expect(screen.getByTestId('db-check-panel-error').textContent).toEqual('0'));
    await waitFor(() => expect(screen.getByTestId('db-check-panel-warning').textContent).toEqual('2'));
    await waitFor(() => expect(screen.getByTestId('db-check-panel-notice').textContent).toEqual('0'));
  });

  it('should render 0 when the sum of all checks is zero for admin user', async () => {
    spyGetAllFailedChecks.mockImplementationOnce(async () => [
      {
        serviceName: '',
        serviceId: '',
        counts: {
          emergency: 0,
          critical: 0,
          alert: 0,
          error: 0,
          warning: 0,
          notice: 0,
          info: 0,
          debug: 0,
        },
      },
      {
        serviceName: '',
        serviceId: '',
        counts: {
          emergency: 0,
          critical: 0,
          alert: 0,
          error: 0,
          warning: 0,
          notice: 0,
          info: 0,
          debug: 0,
        },
      },
    ]);

    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { advisorEnabled: true, isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <Failed />
      </Provider>
    );

    await waitFor(() => expect(screen.getByTestId('db-check-panel-zero-checks')).toBeInTheDocument());
  });

  it('should render 0 when the sum of all checks is zero for editor user', async () => {
    config.bootData.user.isGrafanaAdmin = false;
    config.bootData.user.orgRole = OrgRole.Editor;
    spyGetAllFailedChecks.mockImplementationOnce(async () => [
      {
        serviceName: '',
        serviceId: '',
        counts: {
          emergency: 0,
          critical: 0,
          alert: 0,
          error: 0,
          warning: 0,
          notice: 0,
          info: 0,
          debug: 0,
        },
      },
      {
        serviceName: '',
        serviceId: '',
        counts: {
          emergency: 0,
          critical: 0,
          alert: 0,
          error: 0,
          warning: 0,
          notice: 0,
          info: 0,
          debug: 0,
        },
      },
    ]);

    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: false },
            settings: { loading: false, result: { advisorEnabled: true, isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <Failed />
      </Provider>
    );

    await waitFor(() => expect(screen.getByTestId('db-check-panel-zero-checks')).toBeInTheDocument());
  });

  it('should render unauthorised message and no failed checks for viewer user', async () => {
    config.bootData.user.isGrafanaAdmin = false;
    config.bootData.user.orgRole = OrgRole.Viewer;

    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: false },
            settings: { loading: false, result: { advisorEnabled: true, isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <Failed />
      </Provider>
    );

    await waitFor(() => expect(screen.getByTestId('unauthorized')).toBeInTheDocument());

    expect(spyGetAllFailedChecks).not.toHaveBeenCalled();
  });
});
