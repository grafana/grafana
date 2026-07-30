import { ActionImpl } from 'kbar';
import { render, screen } from 'test/test-utils';

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
  it('renders the action name', () => {
    const action = createActionImpl();
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
  });

  it('renders the managed badge when managedBy is Repo', () => {
    const action = createActionImpl({ managedBy: ManagerKind.Repo });
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument();
  });

  it('does not render the managed badge when managedBy is undefined', () => {
    const action = createActionImpl();
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();
  });

  it('renders the managed badge when managedBy is a non-Repo kind', () => {
    const action = createActionImpl({ managedBy: ManagerKind.Terraform });
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument();
  });

  it('renders the managed badge for plugin-managed resources', () => {
    const action = createActionImpl({ managedBy: ManagerKind.Plugin });
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument();
  });

  it('appends an ellipsis to a parent action that has children but no command or link', () => {
    const parent = createActionImpl({ name: 'Preferences' });
    parent.addChild(createActionImpl({ id: 'child-action', name: 'Theme' }));
    render(<ResultItem action={parent} active={false} currentRootActionId="" />);
    expect(screen.getByText('Preferences...')).toBeInTheDocument();
  });

  it('renders ancestor breadcrumbs when no root action is selected', () => {
    const parent = createActionImpl({ id: 'set-theme', name: 'Set theme' });
    const child = createActionImpl({ id: 'dark', name: 'Dark' });
    parent.addChild(child);
    render(<ResultItem action={child} active={false} currentRootActionId="" />);
    expect(screen.getByText('Set theme')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
  });

  it('drops the current root action from the breadcrumbs', () => {
    const parent = createActionImpl({ id: 'set-theme', name: 'Set theme' });
    const child = createActionImpl({ id: 'dark', name: 'Dark' });
    parent.addChild(child);
    render(<ResultItem action={child} active={false} currentRootActionId="set-theme" />);
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.queryByText('Set theme')).not.toBeInTheDocument();
  });
});
