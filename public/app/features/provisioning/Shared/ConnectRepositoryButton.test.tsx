import { render, screen } from 'test/test-utils';

import { createRepository } from '../mocks/factories';
import { setupProvisioningMswServer } from '../mocks/server';

import { ConnectRepositoryButton } from './ConnectRepositoryButton';

setupProvisioningMswServer();

describe('ConnectRepositoryButton', () => {
  it('renders the Configure button and lists repository types when opened', async () => {
    const { user } = render(<ConnectRepositoryButton items={[]} />);

    const button = await screen.findByRole('button', { name: /configure/i });
    expect(button).toBeEnabled();

    await user.click(button);

    // The dropdown lists the available repository types (driven by repositoryTypes).
    expect(await screen.findAllByRole('menuitem')).not.toHaveLength(0);
  });

  it('disables Configure when the instance is already fully managed', async () => {
    const items = [createRepository({ spec: { sync: { target: 'instance', enabled: true } } })];

    render(<ConnectRepositoryButton items={items} />);

    // checkSyncSettings flags an instance-level connection, so configuring more
    // is disabled (the button keeps a tooltip, hence aria-disabled).
    expect(await screen.findByRole('button', { name: /configure/i })).toHaveAttribute('aria-disabled', 'true');
  });
});
