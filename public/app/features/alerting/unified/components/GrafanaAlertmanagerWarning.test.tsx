import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { setAlertmanagerChoices } from 'app/features/alerting/unified/mocks/server/configure';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types/accessControl';

import { AlertmanagerChoice } from '../../../../plugins/datasource/alertmanager/types';
import { grantUserPermissions } from '../mocks';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { GrafanaAlertmanagerWarning } from './GrafanaAlertmanagerWarning';
setupMswServer();

describe('GrafanaAlertmanagerWarning', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingNotificationsRead]);
  });

  it('Should not render when the datasource is not Grafana', () => {
    setAlertmanagerChoices(AlertmanagerChoice.External, 0);

    const { container } = renderWithStore(<GrafanaAlertmanagerWarning currentAlertmanager="custom-alertmanager" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('Should render warning when the datasource is Grafana and using external AM', async () => {
    setAlertmanagerChoices(AlertmanagerChoice.External, 1);

    renderWithStore(<GrafanaAlertmanagerWarning currentAlertmanager={GRAFANA_RULES_SOURCE_NAME} />);

    expect(await screen.findByText('Grafana alerts are not delivered to Grafana Alertmanager')).toBeVisible();
  });

  it('Should render warning when the datasource is Grafana and using All AM', async () => {
    setAlertmanagerChoices(AlertmanagerChoice.All, 1);

    renderWithStore(<GrafanaAlertmanagerWarning currentAlertmanager={GRAFANA_RULES_SOURCE_NAME} />);

    expect(await screen.findByText('You have additional Alertmanagers to configure')).toBeVisible();
  });

  it('Should render no warning when choice is Internal', async () => {
    setAlertmanagerChoices(AlertmanagerChoice.Internal, 1);

    const { container } = renderWithStore(
      <GrafanaAlertmanagerWarning currentAlertmanager={GRAFANA_RULES_SOURCE_NAME} />
    );

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('Should render no warning when choice is All but no active AM instances', async () => {
    setAlertmanagerChoices(AlertmanagerChoice.All, 0);

    const { container } = renderWithStore(
      <GrafanaAlertmanagerWarning currentAlertmanager={GRAFANA_RULES_SOURCE_NAME} />
    );

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});

function renderWithStore(element: JSX.Element) {
  const store = configureStore();

  return render(<Provider store={store}>{element}</Provider>);
}
