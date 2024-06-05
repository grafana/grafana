import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { setBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';

import { registerMockAPI } from '../../../fixtures/mswAPI';
import { validCloudMigrationToken } from '../../../fixtures/tokens';

import { CallToAction } from './CallToAction';

setBackendSrv(backendSrv);

function render(...[ui, options]: Parameters<typeof rtlRender>) {
  rtlRender(<TestProvider>{ui}</TestProvider>, options);
}

describe('CallToAction', () => {
  registerMockAPI();

  it('opens the modal when clicking on the button', async () => {
    render(<CallToAction />);
    const openButton = screen.getByText('Migrate this instance to Cloud');
    await userEvent.click(openButton);
    expect(screen.getByRole('button', { name: 'Connect to this stack' })).toBeInTheDocument();
  });

  it("closes the modal when clicking on the 'Cancel' button", async () => {
    render(<CallToAction />);

    const openButton = screen.getByText('Migrate this instance to Cloud');
    await userEvent.click(openButton);

    const closeButton = screen.getByText('Cancel');
    await userEvent.click(closeButton);

    expect(screen.queryByRole('button', { name: 'Connect to this stack' })).not.toBeInTheDocument();
  });

  it("disables the connect button when the 'token' field is empty", async () => {
    render(<CallToAction />);

    const openButton = screen.getByText('Migrate this instance to Cloud');
    await userEvent.click(openButton);

    expect(screen.getByRole('button', { name: 'Connect to this stack' })).toBeDisabled();
  });

  it('closes the modal after successfully submitting', async () => {
    render(<CallToAction />);

    const openButton = screen.getByText('Migrate this instance to Cloud');
    await userEvent.click(openButton);

    const tokenField = screen.getByRole('textbox', { name: 'Migration token *' });
    await userEvent.type(tokenField, validCloudMigrationToken);

    const submitButton = screen.getByRole('button', { name: 'Connect to this stack' });
    await userEvent.click(submitButton);

    expect(screen.queryByRole('button', { name: 'Connect to this stack' })).not.toBeInTheDocument();
  });

  it('shows the error', async () => {
    render(<CallToAction />);

    const openButton = screen.getByText('Migrate this instance to Cloud');
    await userEvent.click(openButton);

    const tokenField = screen.getByRole('textbox', { name: 'Migration token *' });
    await userEvent.type(tokenField, 'a wrong token!!');

    const submitButton = screen.getByRole('button', { name: 'Connect to this stack' });
    await userEvent.click(submitButton);

    expect(await screen.findByText('Error saving token')).toBeInTheDocument();
  });
});
