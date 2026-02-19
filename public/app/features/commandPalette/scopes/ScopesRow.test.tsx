import userEvent from '@testing-library/user-event';
import { render, screen } from 'test/test-utils';

import { NodesMap, ScopesMap, SelectedScope } from '../../scopes/selector/types';

import { ScopesRow } from './ScopesRow';

describe('ScopesRow', () => {
  const mockApply = jest.fn();
  const mockDeselectScope = jest.fn();

  const mockSelectedScopes: SelectedScope[] = [
    { scopeId: 'scope1', scopeNodeId: 'node1' },
    { scopeId: 'scope2', scopeNodeId: 'node2' },
  ];

  const mockScopes: ScopesMap = {
    scope1: {
      metadata: { name: 'scope1' },
      spec: { title: 'Scope 1 Title' },
    },
    scope2: {
      metadata: { name: 'scope2' },
      spec: { title: 'Scope 2 Title' },
    },
  };

  const mockNodes: NodesMap = {
    node1: {
      metadata: { name: 'node1' },
      spec: { title: 'Node 1 Title', nodeType: 'leaf' },
    },
    node2: {
      metadata: { name: 'node2' },
      spec: { title: 'Node 2 Title', nodeType: 'leaf' },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render selected scopes with their titles', () => {
    render(
      <ScopesRow
        selectedScopes={mockSelectedScopes}
        isDirty={false}
        apply={mockApply}
        deselectScope={mockDeselectScope}
        scopes={mockScopes}
        nodes={mockNodes}
      />
    );

    expect(screen.getByText('Scopes:')).toBeInTheDocument();
    expect(screen.getByText('Scope 1 Title')).toBeInTheDocument();
    expect(screen.getByText('Scope 2 Title')).toBeInTheDocument();
  });

  it('should show Apply button when isDirty is true', () => {
    render(
      <ScopesRow
        selectedScopes={mockSelectedScopes}
        isDirty={true}
        apply={mockApply}
        deselectScope={mockDeselectScope}
        scopes={mockScopes}
        nodes={mockNodes}
      />
    );

    const applyButton = screen.getByRole('button', { name: /Apply/i });
    expect(applyButton).toBeInTheDocument();
  });

  it('should not show Apply button when isDirty is false', () => {
    render(
      <ScopesRow
        selectedScopes={mockSelectedScopes}
        isDirty={false}
        apply={mockApply}
        deselectScope={mockDeselectScope}
        scopes={mockScopes}
        nodes={mockNodes}
      />
    );

    const applyButton = screen.queryByRole('button', { name: /Apply/i });
    expect(applyButton).not.toBeInTheDocument();
  });

  it('should call apply when Apply button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ScopesRow
        selectedScopes={mockSelectedScopes}
        isDirty={true}
        apply={mockApply}
        deselectScope={mockDeselectScope}
        scopes={mockScopes}
        nodes={mockNodes}
      />
    );

    const applyButton = screen.getByRole('button', { name: /Apply/i });
    await user.click(applyButton);

    expect(mockApply).toHaveBeenCalledTimes(1);
  });

  it('should call deselectScope when a scope pill is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ScopesRow
        selectedScopes={mockSelectedScopes}
        isDirty={false}
        apply={mockApply}
        deselectScope={mockDeselectScope}
        scopes={mockScopes}
        nodes={mockNodes}
      />
    );

    const scope1Pill = screen.getByText('Scope 1 Title');
    await user.click(scope1Pill);

    expect(mockDeselectScope).toHaveBeenCalledWith('node1');
  });

  it('should use node title as fallback when scope title is not available', () => {
    const scopesWithoutTitle: ScopesMap = {};
    render(
      <ScopesRow
        selectedScopes={mockSelectedScopes}
        isDirty={false}
        apply={mockApply}
        deselectScope={mockDeselectScope}
        scopes={scopesWithoutTitle}
        nodes={mockNodes}
      />
    );

    expect(screen.getByText('Node 1 Title')).toBeInTheDocument();
    expect(screen.getByText('Node 2 Title')).toBeInTheDocument();
  });

  it('should use scopeId as fallback when both scope and node titles are not available', () => {
    const emptyScopes: ScopesMap = {};
    const emptyNodes: NodesMap = {};
    render(
      <ScopesRow
        selectedScopes={mockSelectedScopes}
        isDirty={false}
        apply={mockApply}
        deselectScope={mockDeselectScope}
        scopes={emptyScopes}
        nodes={emptyNodes}
      />
    );

    expect(screen.getByText('scope1')).toBeInTheDocument();
    expect(screen.getByText('scope2')).toBeInTheDocument();
  });

  it('should use scopeNodeId for deselectScope when available', async () => {
    const user = userEvent.setup();
    const selectedScopesWithNodeId: SelectedScope[] = [{ scopeId: 'scope1', scopeNodeId: 'node1' }];
    render(
      <ScopesRow
        selectedScopes={selectedScopesWithNodeId}
        isDirty={false}
        apply={mockApply}
        deselectScope={mockDeselectScope}
        scopes={mockScopes}
        nodes={mockNodes}
      />
    );

    const scopePill = screen.getByText('Scope 1 Title');
    await user.click(scopePill);

    expect(mockDeselectScope).toHaveBeenCalledWith('node1');
  });

  it('should use scopeId for deselectScope when scopeNodeId is not available', async () => {
    const user = userEvent.setup();
    const selectedScopesWithoutNodeId: SelectedScope[] = [{ scopeId: 'scope1' }];
    render(
      <ScopesRow
        selectedScopes={selectedScopesWithoutNodeId}
        isDirty={false}
        apply={mockApply}
        deselectScope={mockDeselectScope}
        scopes={mockScopes}
        nodes={mockNodes}
      />
    );

    const scopePill = screen.getByText('Scope 1 Title');
    await user.click(scopePill);

    expect(mockDeselectScope).toHaveBeenCalledWith('scope1');
  });

  it('should render correctly with empty selectedScopes array', () => {
    render(
      <ScopesRow
        selectedScopes={[]}
        isDirty={false}
        apply={mockApply}
        deselectScope={mockDeselectScope}
        scopes={mockScopes}
        nodes={mockNodes}
      />
    );

    expect(screen.getByText('Scopes:')).toBeInTheDocument();
    expect(screen.queryByText('Scope 1 Title')).not.toBeInTheDocument();
  });
});
