import 'whatwg-fetch';
import { setupServer } from 'msw/node';
import React from 'react';
import { render, screen, waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';

import { AlertmanagerChoice } from '../../../../plugins/datasource/alertmanager/types';
import { mockAlertmanagerChoiceResponse } from '../mocks/alertmanagerApi';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { GrafanaAlertmanagerDeliveryWarning } from './GrafanaAlertmanagerDeliveryWarning';

describe('GrafanaAlertmanagerDeliveryWarning', () => {
  const server = setupServer();

  beforeAll(() => {
    setBackendSrv(backendSrv);
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    server.resetHandlers();
  });

  it('Should not render when the datasource is not Grafana', () => {
    mockAlertmanagerChoiceResponse(server, {
      alertmanagersChoice: AlertmanagerChoice.External,
      numExternalAlertmanagers: 0,
    });

    const { container } = render(<GrafanaAlertmanagerDeliveryWarning currentAlertmanager="custom-alertmanager" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('Should render warning when the datasource is Grafana and using external AM', async () => {
    mockAlertmanagerChoiceResponse(server, {
      alertmanagersChoice: AlertmanagerChoice.External,
      numExternalAlertmanagers: 1,
    });

    render(<GrafanaAlertmanagerDeliveryWarning currentAlertmanager={GRAFANA_RULES_SOURCE_NAME} />);

    expect(await screen.findByText('Grafana alerts are not delivered to Grafana Alertmanager')).toBeVisible();
  });

  it('Should render warning when the datasource is Grafana and using All AM', async () => {
    mockAlertmanagerChoiceResponse(server, {
      alertmanagersChoice: AlertmanagerChoice.All,
      numExternalAlertmanagers: 1,
    });

    render(<GrafanaAlertmanagerDeliveryWarning currentAlertmanager={GRAFANA_RULES_SOURCE_NAME} />);

    expect(await screen.findByText('You have additional Alertmanagers to configure')).toBeVisible();
  });

  it('Should render no warning when choice is Internal', async () => {
    mockAlertmanagerChoiceResponse(server, {
      alertmanagersChoice: AlertmanagerChoice.Internal,
      numExternalAlertmanagers: 1,
    });

    const { container } = render(
      <GrafanaAlertmanagerDeliveryWarning currentAlertmanager={GRAFANA_RULES_SOURCE_NAME} />
    );

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('Should render no warning when choice is All but no active AM instances', async () => {
    mockAlertmanagerChoiceResponse(server, {
      alertmanagersChoice: AlertmanagerChoice.All,
      numExternalAlertmanagers: 0,
    });

    const { container } = render(
      <GrafanaAlertmanagerDeliveryWarning currentAlertmanager={GRAFANA_RULES_SOURCE_NAME} />
    );

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
