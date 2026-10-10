import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type ScopeNode } from '@grafana/data';

import { ScopesTreeBreadcrumb } from './ScopesTreeBreadcrumb';
import { type NodesMap, type TreeNode } from './types';

const mockToggleExpandedNode = jest.fn();

jest.mock('./useScopeActions', () => ({
  useScopeActions: () => ({
    toggleExpandedNode: mockToggleExpandedNode,
  }),
}));

describe('ScopesTreeBreadcrumb', () => {
  const applicationsNode: ScopeNode = {
    metadata: { name: 'applications' },
    spec: { title: 'Applications', nodeType: 'container', linkType: 'scope', linkId: '', parentName: '' },
  };
  const cloudNode: ScopeNode = {
    metadata: { name: 'cloud' },
    spec: { title: 'Cloud', nodeType: 'container', linkType: 'scope', linkId: '', parentName: 'applications' },
  };
  const scopeNodes: NodesMap = { applications: applicationsNode, cloud: cloudNode };

  const path: TreeNode[] = [
    { scopeNodeId: 'applications', expanded: true, query: '' },
    { scopeNodeId: 'cloud', expanded: true, query: '' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render nothing when nothing is expanded', () => {
    const { container } = render(<ScopesTreeBreadcrumb path={[]} scopeNodes={scopeNodes} />);

    expect(container.firstChild).toBeNull();
  });

  it('should render the breadcrumb trail using node titles', () => {
    render(<ScopesTreeBreadcrumb path={path} scopeNodes={scopeNodes} />);

    expect(screen.getByText('Applications / Cloud')).toBeInTheDocument();
  });

  it('should collapse back to the top-level ancestor when "Back to top" is clicked', async () => {
    render(<ScopesTreeBreadcrumb path={path} scopeNodes={scopeNodes} />);

    await userEvent.click(screen.getByTestId('scopes-tree-breadcrumb-back'));

    expect(mockToggleExpandedNode).toHaveBeenCalledWith('applications');
  });
});
