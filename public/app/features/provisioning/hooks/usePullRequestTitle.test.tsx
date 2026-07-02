import { act, render, screen, waitFor } from 'test/test-utils';

import { setTestFlags } from '@grafana/test-utils/unstable';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { type WorkflowOption } from '../types';
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
  workflow = 'branch',
}: {
  repository?: RepositoryView;
  vars?: BranchTemplateVars;
  workflow?: WorkflowOption;
}) {
  const { prTitle } = usePullRequestTitle({ repository, vars, workflow });
  return <output data-testid="pr-title">{prTitle}</output>;
}

describe('usePullRequestTitle', () => {
  beforeEach(() => {
    setTestFlags({ 'provisioning.gitConventions': true });
  });

  afterEach(async () => {
    // setTestFlags fires OpenFeature events that update mounted components, so reset within act().
    await act(async () => {
      setTestFlags({});
    });
  });

  it('returns an empty string when the flag is off even with a template configured', () => {
    setTestFlags({ 'provisioning.gitConventions': false });
    render(<Host repository={makeRepo({ titleTemplate: TEMPLATE })} />);

    expect(screen.getByTestId('pr-title')).toBeEmptyDOMElement();
  });

  it('returns an empty string for the write workflow even with a template', () => {
    render(<Host repository={makeRepo({ titleTemplate: TEMPLATE })} workflow="write" />);

    expect(screen.getByTestId('pr-title')).toBeEmptyDOMElement();
  });

  it('renders the template on the branch workflow', async () => {
    render(<Host repository={makeRepo({ titleTemplate: TEMPLATE })} />);

    await waitFor(() => expect(screen.getByTestId('pr-title')).toHaveTextContent('update: My Dashboard'));
  });

  it('returns an empty string on the branch workflow when no template is set', () => {
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
