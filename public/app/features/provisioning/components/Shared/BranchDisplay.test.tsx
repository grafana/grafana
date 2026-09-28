import { render, screen, within } from 'test/test-utils';

import { setupProvisioningMswServer } from '../../mocks/server';

import { BranchDisplay } from './BranchDisplay';

setupProvisioningMswServer();

describe('BranchDisplay', () => {
  it('renders the branch name', () => {
    render(<BranchDisplay baseUrl="https://github.com/org/repo" branch="feature/foo" repoType="github" />);

    expect(screen.getByText('feature/foo')).toBeInTheDocument();
  });

  it('renders as a link opening the branch in a new tab for GitHub repos', () => {
    render(<BranchDisplay baseUrl="https://github.com/org/repo" branch="feature/foo" repoType="github" />);

    const link = screen.getByRole('link', { name: /feature\/foo/ });
    expect(link).toHaveAttribute('href', 'https://github.com/org/repo/tree/feature/foo');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });

  it('builds the correct branch URL for GitLab repos', () => {
    render(<BranchDisplay baseUrl="https://gitlab.com/org/repo" branch="develop" repoType="gitlab" />);

    expect(screen.getByRole('link', { name: /develop/ })).toHaveAttribute(
      'href',
      'https://gitlab.com/org/repo/-/tree/develop'
    );
  });

  it('builds the correct branch URL for Bitbucket repos', () => {
    render(<BranchDisplay baseUrl="https://bitbucket.org/org/repo" branch="main" repoType="bitbucket" />);

    expect(screen.getByRole('link', { name: /main/ })).toHaveAttribute(
      'href',
      'https://bitbucket.org/org/repo/src/main'
    );
  });

  it('sanitizes unsafe branch URLs', () => {
    render(<BranchDisplay baseUrl="javascript:alert(1)" branch="x" repoType="github" />);

    expect(screen.getByRole('link', { name: /x/ })).toHaveAttribute('href', 'about:blank');
  });

  it('renders as plain text (no link) for local repos', () => {
    render(<BranchDisplay baseUrl="https://github.com/org/repo" branch="feature/foo" repoType="local" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('feature/foo')).toBeInTheDocument();
  });

  it('renders as plain text (no link) for unknown repo types', () => {
    render(<BranchDisplay baseUrl="https://github.com/org/repo" branch="feature/foo" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('feature/foo')).toBeInTheDocument();
  });

  it('wires the provided e2e selector onto the link pill', () => {
    render(
      <BranchDisplay
        baseUrl="https://github.com/org/repo"
        branch="feature/foo"
        repoType="github"
        dataTestId="branch-pill"
      />
    );

    const pill = screen.getByTestId('branch-pill');
    expect(within(pill).getByRole('link', { name: /feature\/foo/ })).toBeInTheDocument();
  });

  it('wires the provided e2e selector onto the plain-text pill', () => {
    render(
      <BranchDisplay
        baseUrl="https://github.com/org/repo"
        branch="feature/foo"
        repoType="local"
        dataTestId="branch-pill"
      />
    );

    expect(screen.getByTestId('branch-pill')).toHaveTextContent('feature/foo');
  });
});
