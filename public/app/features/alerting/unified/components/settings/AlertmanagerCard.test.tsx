import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { ConnectionStatus } from '../../hooks/useExternalAmSelector';

import { AlertmanagerCard } from './AlertmanagerCard';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useReturnToPrevious: jest.fn(),
}));

describe('Alertmanager card', () => {
  it('should show metadata', () => {
    render(
      <AlertmanagerCard
        href="/datasource/foo"
        url="http://alertmanager:9090/"
        implementation="mimir"
        logo="https://image.png"
        receiving={true}
        status="active"
        name="External Alertmanager"
        onEditConfiguration={jest.fn()}
        onEnable={jest.fn()}
        onDisable={jest.fn()}
      />
    );

    // check metadata
    const link = screen.getByRole('link', { name: 'External Alertmanager' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/datasource/foo');

    expect(screen.getByText(/Receiving/i)).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === `Mimir|http://alertmanager:9090/`)
    ).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://image.png');
  });

  it('should show correct buttons for disabled alertmanager', async () => {
    const onEditConfiguration = jest.fn();
    const onEnable = jest.fn();
    const onDisable = jest.fn();

    render(
      <AlertmanagerCard
        name="Grafana built-in"
        onEditConfiguration={onEditConfiguration}
        onEnable={onEnable}
        onDisable={onDisable}
      />
    );

    // check actions
    const enableButton = screen.getByRole('button', { name: 'Enable' });
    await userEvent.click(enableButton);
    expect(onEnable).toHaveBeenCalled();

    const editConfigurationButton = screen.getByRole('button', { name: 'Edit configuration' });
    await userEvent.click(editConfigurationButton);
    expect(onEditConfiguration).toHaveBeenCalled();
  });

  it('should show correct buttons for enabled alertmanager', async () => {
    const onDisable = jest.fn();

    render(
      <AlertmanagerCard
        name="Grafana built-in"
        receiving={true}
        onEditConfiguration={jest.fn()}
        onEnable={jest.fn()}
        onDisable={onDisable}
      />
    );

    // check actions
    const disableButton = screen.getByRole('button', { name: 'Disable' });
    await userEvent.click(disableButton);
    expect(onDisable).toHaveBeenCalled();
  });

  it('should not show edit / enable buttons for provisioned alertmanager', () => {
    render(
      <AlertmanagerCard
        name="External Alertmanager"
        receiving={false}
        provisioned={true}
        onEditConfiguration={jest.fn()}
        onEnable={jest.fn()}
        onDisable={jest.fn()}
      />
    );

    // should not have "edit configuration"
    const editConfigurationButton = screen.queryByRole('button', { name: 'Edit configuration' });
    expect(editConfigurationButton).not.toBeInTheDocument();

    // should have "view configuration"
    const viewButton = screen.getByRole('button', { name: 'View configuration' });
    expect(viewButton).toBeInTheDocument();

    const enableButton = screen.queryByRole('button', { name: 'Enable' });
    expect(enableButton).not.toBeInTheDocument();
  });

  it('should show correct buttons for read-only (vanilla) alertmanager', () => {
    render(
      <AlertmanagerCard
        name="External Alertmanager"
        receiving={false}
        provisioned={false}
        readOnly={true}
        onEditConfiguration={jest.fn()}
        onEnable={jest.fn()}
        onDisable={jest.fn()}
      />
    );

    // should not have "edit configuration"
    const editConfigurationButton = screen.queryByRole('button', { name: 'Edit configuration' });
    expect(editConfigurationButton).not.toBeInTheDocument();

    // should have "view configuration"
    const viewButton = screen.getByRole('button', { name: 'View configuration' });
    expect(viewButton).toBeInTheDocument();

    // should be able to enable / disable
    const enableButton = screen.getByRole('button', { name: 'Enable' });
    expect(enableButton).toBeInTheDocument();
  });

  it('should render correct status', () => {
    render(cardWithStatus('active'));
    expect(screen.getByText(/Receiving/)).toBeInTheDocument();

    render(cardWithStatus('dropped'));
    expect(screen.getByText(/Failed to adopt/)).toBeInTheDocument();

    render(cardWithStatus('pending'));
    expect(screen.getByText(/Activation in progress/)).toBeInTheDocument();

    render(cardWithStatus('inconclusive'));
    expect(screen.getByText(/Inconclusive/)).toBeInTheDocument();
  });

  it('should not render the enable / disable buttons or status when disabled', () => {
    render(
      <AlertmanagerCard
        name="Foo"
        receiving={true}
        status="active"
        showStatus={false}
        onEditConfiguration={jest.fn()}
      />
    );

    const enableButton = screen.queryByRole('button', { name: 'Enable' });
    expect(enableButton).not.toBeInTheDocument();

    // should also not show the status for external alertmanagers
    expect(screen.queryByText(/Receiving/)).not.toBeInTheDocument();
  });
});

const cardWithStatus = (status: ConnectionStatus) => (
  <AlertmanagerCard
    name="External Alertmanager"
    receiving={true}
    status={status}
    onEditConfiguration={jest.fn()}
    onEnable={jest.fn()}
    onDisable={jest.fn()}
  />
);
