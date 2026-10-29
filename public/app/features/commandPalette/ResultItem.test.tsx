import { ActionImpl } from 'kbar';
import { act, render, screen, within } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
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
  let originalProvisioning: boolean;

  beforeEach(() => {
    setTestFlags({ 'grafana.cmdkDashboardTags': true });
    originalProvisioning = config.provisioningEnabled;
    const rect = document.createElement('div').getBoundingClientRect();
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return { ...rect, width: Array.from(this.children).some((child) => child.tagName === 'UL') ? 400 : 40 };
    });
  });

  afterEach(() => {
    act(() => setTestFlags({}));
    config.provisioningEnabled = originalProvisioning;
    jest.restoreAllMocks();
  });

  it('renders the action name', () => {
    const action = createActionImpl();
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
  });

  it('renders the managed badge when managedBy is Repo and provisioning toggle is on', () => {
    config.provisioningEnabled = true;
    const action = createActionImpl({ managedBy: ManagerKind.Repo });
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument();
  });

  it('does not render the managed badge when managedBy is undefined', () => {
    config.provisioningEnabled = true;
    const action = createActionImpl();
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();
  });

  it('renders the managed badge when managedBy is a non-Repo kind', () => {
    config.provisioningEnabled = true;
    const action = createActionImpl({ managedBy: ManagerKind.Terraform });
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument();
  });

  it('renders the managed badge for plugin-managed resources', () => {
    config.provisioningEnabled = true;
    const action = createActionImpl({ managedBy: ManagerKind.Plugin });
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument();
  });

  it('does not render the managed badge when provisioning toggle is off', () => {
    config.provisioningEnabled = false;
    const action = createActionImpl({ managedBy: ManagerKind.Repo });
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();
  });

  it('renders the dashboard tags of the action', () => {
    const action = createActionImpl({ tags: ['prod', 'team-a'] });
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    const tagList = screen.getByRole('list', { name: 'Tags' });
    expect(within(tagList).getByText('prod')).toBeInTheDocument();
    expect(within(tagList).getByText('team-a')).toBeInTheDocument();
  });

  it.each([
    { desc: 'disabled', enabled: false },
    { desc: 'not configured', enabled: undefined },
  ])('hides tags but keeps the title, subtitle, and managed badge when the tag flag is $desc', ({ enabled }) => {
    setTestFlags(enabled === undefined ? {} : { 'grafana.cmdkDashboardTags': enabled });
    config.provisioningEnabled = true;
    const action = createActionImpl({ subtitle: 'My folder', managedBy: ManagerKind.Repo, tags: ['prod', 'team-a'] });
    render(<ResultItem action={action} active={false} currentRootActionId="" />);

    expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
    expect(screen.getByText('My folder')).toBeInTheDocument();
    expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Tags' })).not.toBeInTheDocument();
  });

  it('shows more than three tags when they fit in the row', () => {
    const action = createActionImpl({ tags: ['a', 'b', 'c', 'd', 'e'] });
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    const tagList = screen.getByRole('list', { name: 'Tags' });
    expect(within(tagList).getAllByRole('listitem')).toHaveLength(5);
    expect(within(tagList).getByText('e')).toBeInTheDocument();
    expect(within(tagList).queryByText(/\+/)).not.toBeInTheDocument();
  });

  it.each([
    { desc: 'an empty tag array', tags: [] },
    { desc: 'no tags property', tags: undefined },
  ])('does not render a tag list for an action with $desc', ({ tags }) => {
    const action = createActionImpl({ tags });
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Tags' })).not.toBeInTheDocument();
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
