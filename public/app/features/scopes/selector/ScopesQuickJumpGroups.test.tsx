import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type ScopeNode } from '@grafana/data';

import { ScopesQuickJumpGroups } from './ScopesQuickJumpGroups';
import { type NodesMap, type QuickJumpGroup } from './types';

describe('ScopesQuickJumpGroups', () => {
  const cloudNode: ScopeNode = {
    metadata: { name: 'cloud' },
    spec: { title: 'Cloud', nodeType: 'container', linkType: 'scope', linkId: '', parentName: 'applications' },
  };
  const applicationsNode: ScopeNode = {
    metadata: { name: 'applications' },
    spec: { title: 'Applications', nodeType: 'container', linkType: 'scope', linkId: '', parentName: '' },
  };

  const scopeNodes: NodesMap = { cloud: cloudNode, applications: applicationsNode };
  const groups: QuickJumpGroup[] = [{ scopeNodeId: 'cloud', path: ['applications', 'cloud'] }];

  it('should render nothing when there are no groups', () => {
    const { container } = render(<ScopesQuickJumpGroups groups={[]} scopeNodes={{}} onSelect={jest.fn()} />);

    expect(container.firstChild).toBeNull();
  });

  it('should render a badge with the group title and its parent for context', () => {
    render(<ScopesQuickJumpGroups groups={groups} scopeNodes={scopeNodes} onSelect={jest.fn()} />);

    expect(screen.getByText('Applications / Cloud')).toBeInTheDocument();
  });

  it('should fall back to the raw id when the node title is not yet cached', () => {
    render(<ScopesQuickJumpGroups groups={groups} scopeNodes={{}} onSelect={jest.fn()} />);

    expect(screen.getByText('cloud')).toBeInTheDocument();
  });

  it('should call onSelect with the group scopeNodeId when clicked', async () => {
    const onSelect = jest.fn();
    render(<ScopesQuickJumpGroups groups={groups} scopeNodes={scopeNodes} onSelect={onSelect} />);

    await userEvent.click(screen.getByTestId('scopes-tree-quick-jump-cloud'));

    expect(onSelect).toHaveBeenCalledWith('cloud');
  });
});
