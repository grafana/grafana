import { ActionImpl } from 'kbar';
import { render, screen } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { ManagerKind } from 'app/features/apiserver/types';

import { ResultItem } from './ResultItem';

function createActionImpl(props: Record<string, unknown> = {}): ActionImpl {
  const action = {
    id: 'test-action',
    name: 'Test Dashboard',
    ...props,
  };
  return ActionImpl.create(action, { store: {} });
}

describe('ResultItem', () => {
  let originalProvisioning: boolean | undefined;

  beforeEach(() => {
    originalProvisioning = config.featureToggles.provisioning;
  });

  afterEach(() => {
    config.featureToggles.provisioning = originalProvisioning;
  });

  it('renders the action name', () => {
    const action = createActionImpl();
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
  });

  it('renders provisioned badge when managedBy is Repo and provisioning toggle is on', () => {
    config.featureToggles.provisioning = true;
    const action = createActionImpl({ managedBy: ManagerKind.Repo });
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.getByLabelText('Provisioned')).toBeInTheDocument();
  });

  it('does not render provisioned badge when managedBy is undefined', () => {
    config.featureToggles.provisioning = true;
    const action = createActionImpl();
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.queryByLabelText('Provisioned')).not.toBeInTheDocument();
  });

  it('does not render provisioned badge when managedBy is a non-Repo kind', () => {
    config.featureToggles.provisioning = true;
    const action = createActionImpl({ managedBy: ManagerKind.Terraform });
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.queryByLabelText('Provisioned')).not.toBeInTheDocument();
  });

  it('does not render provisioned badge for classic provisioning (Plugin)', () => {
    config.featureToggles.provisioning = true;
    const action = createActionImpl({ managedBy: ManagerKind.Plugin });
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.queryByLabelText('Provisioned')).not.toBeInTheDocument();
  });

  it('does not render provisioned badge when provisioning toggle is off', () => {
    config.featureToggles.provisioning = false;
    const action = createActionImpl({ managedBy: ManagerKind.Repo });
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.queryByLabelText('Provisioned')).not.toBeInTheDocument();
  });

  it('does not render provisioned badge when provisioning toggle is undefined', () => {
    config.featureToggles.provisioning = undefined;
    const action = createActionImpl({ managedBy: ManagerKind.Repo });
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.queryByLabelText('Provisioned')).not.toBeInTheDocument();
  });
});
