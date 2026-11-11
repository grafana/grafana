import { render, screen, waitFor } from 'test/test-utils';

import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { type BranchTemplateVars } from '../utils/branchName';

import { usePullRequestTitle } from './usePullRequestTitle';

const TEMPLATE = '{{action}}: {{title}}';
const dashboardVars: BranchTemplateVars = {
  action: 'update',
  resourceKind: 'dashboard',
  title: 'My Dashboard',
  userLogin: 'ada',
};

function makeRepo(pullRequest?: RepositoryView['pullRequest']): RepositoryView {
  return {
    name: 'repo',
    title: 'Repo',
    target: 'folder',
    type: 'github',
    workflows: ['branch', 'write'],
    pullRequest,
  };
}

function Host({
  repository,
  vars = dashboardVars,
  isNewBranch = true,
}: {
  repository?: RepositoryView;
  vars?: BranchTemplateVars;
  isNewBranch?: boolean;
}) {
  const { prTitle } = usePullRequestTitle({ repository, vars, isNewBranch });
  return <output data-testid="pr-title">{prTitle}</output>;
}

describe('usePullRequestTitle', () => {
  it('returns an empty string when the ref is not a new branch even with a template', () => {
    render(<Host repository={makeRepo({ titleTemplate: TEMPLATE })} isNewBranch={false} />);

    expect(screen.getByTestId('pr-title')).toBeEmptyDOMElement();
  });

  it('renders the template when the ref is a new branch', async () => {
    render(<Host repository={makeRepo({ titleTemplate: TEMPLATE })} />);

    await waitFor(() => expect(screen.getByTestId('pr-title')).toHaveTextContent('update: My Dashboard'));
  });

  it('returns an empty string on a new branch when no template is set', () => {
    render(<Host repository={makeRepo()} />);

    expect(screen.getByTestId('pr-title')).toBeEmptyDOMElement();
  });

  it('substitutes the {{random}} token so it never leaks literally', async () => {
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0);
    try {
      render(<Host repository={makeRepo({ titleTemplate: 'pr-{{random}}' })} />);
      // Math.floor(0 * 36) === 0 -> 'a' for every position of the 6-char token.
      await waitFor(() => expect(screen.getByTestId('pr-title')).toHaveTextContent('pr-aaaaaa'));
    } finally {
      spy.mockRestore();
    }
  });
});
