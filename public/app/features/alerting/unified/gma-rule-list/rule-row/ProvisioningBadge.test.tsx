import { render, screen } from 'test/test-utils';

import { ProvisioningBadge } from './ProvisioningBadge';

describe('ProvisioningBadge', () => {
  it.each<{ name: string; managerKind?: string; tooltip: string }>([
    { name: 'Terraform', managerKind: 'terraform', tooltip: 'Provisioned by Terraform' },
    { name: 'Git sync', managerKind: 'repo', tooltip: 'Provisioned by Git sync' },
    {
      name: 'classic file provisioning',
      managerKind: 'classic-file-provisioning',
      tooltip: 'Provisioned via file provisioning',
    },
    {
      name: 'classic API provisioning',
      managerKind: 'classic-api-provisioning',
      tooltip: 'Provisioned via the provisioning API',
    },
    { name: 'no manager', tooltip: 'Provisioned' },
  ])('explains in its tooltip that the rule is $name: "$tooltip"', async ({ managerKind, tooltip }) => {
    const { user } = render(<ProvisioningBadge managerKind={managerKind} />);

    await user.hover(screen.getByText('Provisioned'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(new RegExp(`^${tooltip}$`));
  });
});
